import type { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/api-error.js';
import { db } from '../../db/index.js';
import { contacts } from '../../db/schema/contacts.js';
import { organizations } from '../../db/schema/organizations.js';
import { users } from '../../db/schema/users.js';
import { getEffectivePermissions } from '../../constants/permissions.js';
import { eq, and } from 'drizzle-orm';
const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

/**
 * Helper to set refresh token in httpOnly cookie.
 */
function setRefreshTokenCookie(res: Response, token: string): void {
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  });
}

/**
 * Helper to clear refresh token cookie.
 */
function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
}

/**
 * Controller class for authentication endpoints.
 */
export const authController = {
  /**
   * POST /api/v1/auth/register
   * Registers a new organization and owner account.
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user, tokens } = await authService.register(req.body);
      
      setRefreshTokenCookie(res, tokens.refreshToken);

      sendSuccess(
        res,
        { user, accessToken: tokens.accessToken },
        'Registration successful',
        201
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/auth/login
   * Authenticates user and returns credentials.
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user, tokens } = await authService.login(req.body);
      
      setRefreshTokenCookie(res, tokens.refreshToken);

      let companyName: string | undefined;
      let gstin: string | undefined;

      if (user.contactId) {
        const contact = await db.query.contacts.findFirst({
          where: and(
            eq(contacts.id, user.contactId),
            eq(contacts.orgId, user.orgId)
          ),
          columns: { companyName: true, displayName: true, gstin: true },
        });
        if (contact) {
          companyName = contact.companyName || contact.displayName;
          gstin = contact.gstin || undefined;
        }
      } else {
        const org = await db.query.organizations.findFirst({
          where: eq(organizations.id, user.orgId),
          columns: { name: true },
        });
        if (org) {
          companyName = org.name;
        }
      }

      sendSuccess(
        res,
        { user: { ...user, companyName, gstin }, accessToken: tokens.accessToken },
        'Login successful'
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/auth/refresh
   * Rotates access and refresh tokens.
   */
  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies[REFRESH_TOKEN_COOKIE_NAME];
      if (!refreshToken) {
        throw ApiError.unauthorized('Refresh token is missing');
      }

      const { user, tokens } = await authService.refresh(refreshToken);

      setRefreshTokenCookie(res, tokens.refreshToken);

      let companyName: string | undefined;
      let gstin: string | undefined;

      if (user.contactId) {
        const contact = await db.query.contacts.findFirst({
          where: and(
            eq(contacts.id, user.contactId),
            eq(contacts.orgId, user.orgId)
          ),
          columns: { companyName: true, displayName: true, gstin: true },
        });
        if (contact) {
          companyName = contact.companyName || contact.displayName;
          gstin = contact.gstin || undefined;
        }
      } else {
        const org = await db.query.organizations.findFirst({
          where: eq(organizations.id, user.orgId),
          columns: { name: true },
        });
        if (org) {
          companyName = org.name;
        }
      }

      sendSuccess(
        res,
        { user: { ...user, companyName, gstin }, accessToken: tokens.accessToken },
        'Token refreshed successfully'
      );
    } catch (error) {
      // Clear cookie if refresh failed due to token invalidity
      clearRefreshTokenCookie(res);
      next(error);
    }
  },

  /**
   * POST /api/v1/auth/logout
   * Logs out the user by clearing the HTTP-only cookie.
   */
  async logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      clearRefreshTokenCookie(res);
      sendSuccess(res, null, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/auth/me
   * Retrieves the current authenticated user's session from JWT.
   */
  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Not authenticated');
      }

      let companyName: string | undefined;
      let gstin: string | undefined;

      // If user has a contactId (i.e. is a customer), fetch companyName from contacts table
      if (req.user.contactId) {
        const contact = await db.query.contacts.findFirst({
          where: and(
            eq(contacts.id, req.user.contactId),
            eq(contacts.orgId, req.user.orgId)
          ),
          columns: { companyName: true, displayName: true, gstin: true },
        });
        if (contact) {
          companyName = contact.companyName || contact.displayName;
          gstin = contact.gstin || undefined;
        }
      }

      const dbUser = await db.query.users.findFirst({
        where: eq(users.id, req.user.userId),
        columns: {
          id: true,
          orgId: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          contactId: true,
          permissions: true,
          avatarUrl: true,
        },
      });

      const effectivePerms = dbUser 
        ? getEffectivePermissions(dbUser.role, dbUser.permissions)
        : (req.user.permissions || []);

      sendSuccess(
        res,
        { 
          user: { 
            ...(dbUser || req.user),
            permissions: effectivePerms,
            companyName, 
            gstin 
          } 
        },
        'Current user retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/auth/forgot-password
   */
  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.forgotPassword(req.body);
      // Always return success to prevent email enumeration
      sendSuccess(res, null, 'If an account exists with that email, a password reset link has been generated.');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/auth/reset-password
   */
  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.resetPassword(req.body);
      sendSuccess(res, null, 'Password reset successfully');
    } catch (error) {
      next(error);
    }
  },
};
