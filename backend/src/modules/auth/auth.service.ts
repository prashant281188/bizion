import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../../db/index.js';
import { organizations } from '../../db/schema/organizations.js';
import { users } from '../../db/schema/users.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/api-error.js';
import { eq, and, or } from 'drizzle-orm';
import { seedTaxRates } from '../../db/seed/tax-rates.js';
import { seedUnits } from '../../db/seed/units.js';
import { seedPaymentTerms } from '../../db/seed/payment-terms.js';
import { seedChartOfAccounts } from '../../db/seed/chart-of-accounts.js';
import { getEffectivePermissions } from '../../constants/permissions.js';
import type { RegisterInput, LoginInput } from './auth.schema.js';

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface UserSession {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  role: string;
  orgId: string;
  contactId?: string | null;
  permissions: string[];
}

/**
 * Generate Access and Refresh Token pair for a user.
 */
function generateTokens(payload: { userId: string; orgId: string; email: string; role: string; contactId?: string | null; permissions?: string[] }): TokenResponse {
  const accessToken = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any,
  });

  const refreshToken = jwt.sign({ userId: payload.userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
  });

  return { accessToken, refreshToken };
}

/**
 * Auth Service containing business logic for registration, login, and token refresh.
 */
export const authService = {
  /**
   * Register a new organization and create its owner user.
   * Auto-seeds standard master data (GST rates, UOMs, Payment Terms, CoA).
   */
  async register(input: RegisterInput): Promise<{ user: UserSession; tokens: TokenResponse }> {
    // Check if organization slug is taken
    const existingOrg = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, input.slug))
      .limit(1);

    if (existingOrg.length > 0) {
      throw ApiError.badRequest('Organization slug is already taken');
    }

    // Check if user email is already registered
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);

    if (existingUser.length > 0) {
      throw ApiError.badRequest('Email address is already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    // Perform database operations in a transaction
    const result = await db.transaction(async (tx) => {
      // 1. Create Organization
      const [org] = await tx
        .insert(organizations)
        .values({
          name: input.orgName,
          legalName: input.legalName || input.orgName,
          slug: input.slug,
          status: 'trial',
          plan: 'free',
        })
        .returning();

      // 2. Create Owner User
      const [user] = await tx
        .insert(users)
        .values({
          orgId: org.id,
          email: input.email,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName || null,
          phone: input.phone || null,
          role: 'owner',
          status: 'active',
          emailVerifiedAt: new Date(),
        })
        .returning();

      // 3. Auto-seed tenant master data (GST, UOMs, Terms, Chart of Accounts)
      // Passing tx as any to satisfy type compatibility between postgres-js Database and Transaction
      await seedTaxRates(tx as any, org.id);
      await seedUnits(tx as any, org.id);
      await seedPaymentTerms(tx as any, org.id);
      await seedChartOfAccounts(tx as any, org.id);

      return { org, user };
    });

    const userPermissions = getEffectivePermissions(result.user.role, result.user.permissions);

    const tokens = generateTokens({
      userId: result.user.id,
      orgId: result.org.id,
      email: result.user.email,
      role: result.user.role,
      permissions: userPermissions,
    });

    const userSession: UserSession = {
      id: result.user.id,
      email: result.user.email,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      role: result.user.role,
      orgId: result.user.orgId,
      permissions: userPermissions,
    };

    return { user: userSession, tokens };
  },

  /**
   * Log in an existing user.
   */
  async login(input: LoginInput & { identifier?: string; email?: string }): Promise<{ user: UserSession; tokens: TokenResponse }> {
    const loginId = input.identifier || input.email; // Fallback to email for backwards compatibility
    
    if (!loginId) {
      throw ApiError.badRequest('Email or mobile number is required');
    }

    // Find user by email or phone
    const [user] = await db
      .select()
      .from(users)
      .where(or(eq(users.email, loginId), eq(users.phone, loginId)))
      .limit(1);

    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    if (user.status !== 'active') {
      throw ApiError.forbidden('Your account is currently inactive or suspended');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const userPermissions = getEffectivePermissions(user.role, user.permissions);

    // Generate tokens
    const tokens = generateTokens({
      userId: user.id,
      orgId: user.orgId,
      email: user.email,
      role: user.role,
      contactId: user.contactId,
      permissions: userPermissions,
    });

    const userSession: UserSession = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      orgId: user.orgId,
      contactId: user.contactId,
      permissions: userPermissions,
    };

    // Update last login
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    return { user: userSession, tokens };
  },

  /**
   * Refresh credentials using refresh token.
   */
  async refresh(token: string): Promise<{ user: UserSession; tokens: TokenResponse }> {
    try {
      const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as { userId: string };

      // Find user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, decoded.userId))
        .limit(1);

      if (!user) {
        throw ApiError.unauthorized('User not found');
      }

      if (user.status !== 'active') {
        throw ApiError.forbidden('Your account is inactive or suspended');
      }

      const userPermissions = getEffectivePermissions(user.role, user.permissions);

      // Generate new tokens
      const tokens = generateTokens({
        userId: user.id,
        orgId: user.orgId,
        email: user.email,
        role: user.role,
        contactId: user.contactId,
        permissions: userPermissions,
      });

      const userSession: UserSession = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        orgId: user.orgId,
        contactId: user.contactId,
        permissions: userPermissions,
      };

      return { user: userSession, tokens };
    } catch (error) {
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }
  },

  /**
   * Request a password reset.
   * Finds user by email or mobile number, generates a secure 15-minute token.
   */
  async forgotPassword({ identifier, email }: { identifier?: string; email?: string }): Promise<void> {
    const inputId = (identifier || email || '').trim();
    if (!inputId) return;

    // Find user by email or mobile number
    const [user] = await db
      .select()
      .from(users)
      .where(or(eq(users.email, inputId), eq(users.phone, inputId)))
      .limit(1);

    if (!user) {
      // Don't reveal if user exists (security best practice)
      return;
    }

    // Generate random crypto reset token (valid for 15 minutes)
    const crypto = await import('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await db
      .update(users)
      .set({ resetToken, resetExpiresAt: expiresAt })
      .where(eq(users.id, user.id));

    // Dynamic reset link based on client origin or app url
    const baseUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

    console.log(`\n========================================`);
    console.log(`🔑 PASSWORD RESET LINK FOR ${user.email} (${user.phone || 'No phone'}):`);
    console.log(resetLink);
    console.log(`Expires at: ${expiresAt.toISOString()}`);
    console.log(`========================================\n`);

    // Dispatch email
    const { emailService } = await import('../../utils/email.service.js');
    await emailService.sendPasswordResetEmail(user.email, resetLink, user.firstName);
  },

  /**
   * Reset password using token.
   */
  async resetPassword({ token, password }: { token: string; password: string }): Promise<void> {
    const [user] = await db.select().from(users).where(eq(users.resetToken, token)).limit(1);

    if (!user || !user.resetExpiresAt || user.resetExpiresAt < new Date()) {
      throw ApiError.badRequest('Invalid or expired reset token');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    await db
      .update(users)
      .set({ 
        passwordHash, 
        resetToken: null, 
        resetExpiresAt: null 
      })
      .where(eq(users.id, user.id));
  },
};
