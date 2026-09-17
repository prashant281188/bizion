import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/api-error.js';

/**
 * Role hierarchy for the Bizion platform.
 * Higher index = higher privilege. A role can access anything its level or below can.
 *
 * Role descriptions:
 * - viewer: Read-only access to reports and data
 * - agent: Basic operations (create invoices, manage contacts)
 * - accountant: Financial operations (payments, accounting, GST)
 * - manager: Department-level management
 * - admin: Organization-wide administration
 * - owner: Full access including billing and org settings
 */
const ROLE_HIERARCHY: Record<string, number> = {
  viewer: 0,
  agent: 1,
  accountant: 2,
  manager: 3,
  admin: 4,
  owner: 5,
};

/**
 * Role-based access control middleware factory.
 * Restricts access to users with the specified role(s).
 *
 * @param allowedRoles - Array of roles that are permitted access
 *
 * Usage:
 *   router.delete('/org', authorize(['owner']), controller.deleteOrg);
 *   router.post('/invoice', authorize(['agent', 'accountant', 'manager', 'admin', 'owner']), controller.create);
 */
export function authorize(allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required');
    }

    const userRole = req.user.role;

    // Admin and owner are super-users and can bypass any specific allowed role checks
    if (userRole === 'admin' || userRole === 'owner') {
      return next();
    }

    if (!allowedRoles.includes(userRole)) {
      throw ApiError.forbidden(
        `Access denied. Required role(s): ${allowedRoles.join(', ')}. Your role: ${userRole}`
      );
    }

    next();
  };
}

/**
 * Minimum role level access control middleware.
 * Grants access to users with the specified role or any role above it in the hierarchy.
 *
 * @param minimumRole - The minimum role level required
 *
 * Usage:
 *   router.get('/reports', requireMinRole('accountant'), controller.reports);
 *   // Allows: accountant, manager, admin, owner
 */
export function requireMinRole(minimumRole: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required');
    }

    const userRole = req.user.role;

    // Admin and owner can bypass any minimum role level requirements
    if (userRole === 'admin' || userRole === 'owner') {
      return next();
    }

    const userRoleLevel = ROLE_HIERARCHY[userRole] ?? -1;
    const requiredLevel = ROLE_HIERARCHY[minimumRole] ?? Infinity;

    if (userRoleLevel < requiredLevel) {
      throw ApiError.forbidden(
        `Access denied. Minimum role required: ${minimumRole}. Your role: ${userRole}`
      );
    }

    next();
  };
}

/**
 * Permission-based access control middleware.
 * Checks whether the user's role or custom permissions include the required action.
 *
 * @param requiredPermission - String in format 'module:action', e.g. 'invoices:create'
 *
 * Usage:
 *   router.post('/', authenticate, requirePermission('invoices:create'), controller.create);
 */
export function requirePermission(requiredPermission: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required');
    }

    const userRole = req.user.role;

    // Owner and Admin bypass all permission checks
    if (userRole === 'owner' || userRole === 'admin') {
      return next();
    }

    const userPermissions = req.user.permissions || [];
    
    // Check wildcard or specific permission
    if (
      userPermissions.includes('*') ||
      userPermissions.includes(requiredPermission)
    ) {
      return next();
    }

    throw ApiError.forbidden(
      `Access denied. Missing required permission: ${requiredPermission}`
    );
  };
}

