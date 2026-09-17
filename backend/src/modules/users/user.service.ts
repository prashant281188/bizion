import bcrypt from 'bcryptjs';
import { db } from '../../db/index.js';
import { users } from '../../db/schema/users.js';
import { ApiError } from '../../utils/api-error.js';
import { eq, and, isNull, like, or, not } from 'drizzle-orm';
import type { CreateUserInput, UpdateUserInput } from './user.schema.js';

export const userService = {
  /**
   * List all active (non-deleted) users in an organization with optional search.
   */
  async listUsers(orgId: string, search?: string, userType?: 'operational' | 'portal') {
    let query = db
      .select({
        id: users.id,
        orgId: users.orgId,
        contactId: users.contactId,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
        avatarUrl: users.avatarUrl,
        role: users.role,
        permissions: users.permissions,
        status: users.status,
        emailVerifiedAt: users.emailVerifiedAt,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(
        and(
          eq(users.orgId, orgId),
          isNull(users.deletedAt),
          userType === 'operational' ? not(eq(users.role, 'customer')) : undefined,
          userType === 'portal' ? eq(users.role, 'customer') : undefined
        )
      );

    const results = await query;

    if (search) {
      const searchLower = search.toLowerCase();
      return results.filter(
        (u) =>
          u.firstName.toLowerCase().includes(searchLower) ||
          (u.lastName && u.lastName.toLowerCase().includes(searchLower)) ||
          u.email.toLowerCase().includes(searchLower)
      );
    }

    return results;
  },

  /**
   * Get user details by ID within organization scope.
   */
  async getUserById(orgId: string, userId: string) {
    const [user] = await db
      .select({
        id: users.id,
        orgId: users.orgId,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
        avatarUrl: users.avatarUrl,
        role: users.role,
        permissions: users.permissions,
        status: users.status,
        emailVerifiedAt: users.emailVerifiedAt,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(
        and(
          eq(users.orgId, orgId),
          eq(users.id, userId),
          isNull(users.deletedAt)
        )
      )
      .limit(1);

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    return user;
  },

  /**
   * Create a new user in the organization.
   */
  async createUser(orgId: string, input: CreateUserInput) {
    // Check if user already exists in organization
    const [existing] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.orgId, orgId),
          eq(users.email, input.email)
        )
      )
      .limit(1);

    if (existing) {
      if (!existing.deletedAt) {
        throw ApiError.badRequest('User with this email is already registered in your organization');
      }

      // Reactivate soft-deleted user
      const tempPassword = `Invite@${Math.random().toString(36).substring(2, 10)}`;
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      const [reactivatedUser] = await db
        .update(users)
        .set({
          firstName: input.firstName,
          lastName: input.lastName || null,
          phone: input.phone || null,
          role: input.role,
          permissions: input.permissions || [],
          status: 'active',
          passwordHash,
          deletedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.id))
        .returning();

      return {
        id: reactivatedUser.id,
        email: reactivatedUser.email,
        firstName: reactivatedUser.firstName,
        lastName: reactivatedUser.lastName,
        phone: reactivatedUser.phone,
        role: reactivatedUser.role,
        permissions: reactivatedUser.permissions,
        status: reactivatedUser.status,
        createdAt: reactivatedUser.createdAt,
        tempPassword,
      };
    }

    // Generate random/temporary password that needs to be reset
    const tempPassword = `Invite@${Math.random().toString(36).substring(2, 10)}`;
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const [user] = await txInsert(orgId, input, passwordHash);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      permissions: user.permissions,
      status: user.status,
      createdAt: user.createdAt,
      // Return temporary password so admin can communicate it
      tempPassword,
    };
  },

  /**
   * Update user details or role.
   */
  async updateUser(orgId: string, userId: string, input: UpdateUserInput) {
    // Check user existence
    await this.getUserById(orgId, userId);

    const updateData: any = { ...input };
    
    if (input.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(input.password, salt);
      delete updateData.password;
    }

    updateData.updatedAt = new Date();

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(
        and(
          eq(users.orgId, orgId),
          eq(users.id, userId),
          isNull(users.deletedAt)
        )
      )
      .returning({
        id: users.id,
        orgId: users.orgId,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
        role: users.role,
        permissions: users.permissions,
        status: users.status,
        updatedAt: users.updatedAt,
      });

    return updatedUser;
  },

  /**
   * Generate a customer portal user linked to a contact.
   */
  async generateCustomer(orgId: string, contactId: string, email: string, rawPassword?: string) {
    // Check if user already exists
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      throw ApiError.badRequest('User with this email already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(rawPassword || 'TempPass123!', salt);

    const [user] = await db.insert(users).values({
      orgId,
      contactId,
      email,
      passwordHash,
      firstName: 'Customer',
      role: 'customer',
      permissions: ['products:read', 'orders:read', 'orders:create', 'invoices:read'],
      status: 'active',
    }).returning({
      id: users.id,
      email: users.email,
      role: users.role,
      permissions: users.permissions,
      contactId: users.contactId,
    });

    return user;
  },

  /**
   * Soft-delete/deactivate user.
   */
  async deactivateUser(orgId: string, userId: string) {
    const user = await this.getUserById(orgId, userId);
    
    if (user.role === 'owner') {
      throw ApiError.forbidden('Cannot deactivate the organization owner');
    }

    await db
      .update(users)
      .set({
        status: 'inactive',
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(users.orgId, orgId),
          eq(users.id, userId)
        )
      );
  },
};

/**
 * Separate helper to run insert query cleanly.
 */
async function txInsert(orgId: string, input: CreateUserInput, passwordHash: string) {
  return await db
    .insert(users)
    .values({
      orgId,
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName || null,
      phone: input.phone || null,
      role: input.role,
      permissions: input.permissions || [],
      status: 'active',
    })
    .returning();
}
