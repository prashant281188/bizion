import type { Request, Response, NextFunction } from 'express';
import { userService } from './user.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { ApiError } from '../../utils/api-error.js';
import { PERMISSION_MODULES, DEFAULT_ROLE_PERMISSIONS } from '../../constants/permissions.js';

export const userController = {
  /**
   * GET /api/v1/users/permissions-list
   * Returns list of available system permission definitions grouped by module.
   */
  async getPermissionsList(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(
        res,
        {
          modules: PERMISSION_MODULES,
          roleDefaults: DEFAULT_ROLE_PERMISSIONS,
        },
        'Permission definitions retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  },
  /**
   * GET /api/v1/users
   * Lists all active users inside the current organization.
   */
  async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) {
        throw ApiError.unauthorized('Not authenticated');
      }

      const search = req.query.q as string | undefined;
      const type = req.query.type as 'operational' | 'portal' | undefined;
      const usersList = await userService.listUsers(orgId, search, type);
      sendSuccess(res, usersList, 'Users list retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/users/:id
   * Retrieves detail profile of a user by ID.
   */
  async getUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      const userId = req.params.id as string;
      if (!orgId) {
        throw ApiError.unauthorized('Not authenticated');
      }

      const userDetail = await userService.getUserById(orgId, userId);
      sendSuccess(res, userDetail, 'User details retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/users/create
   * Creates a new user in the organization.
   */
  async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) {
        throw ApiError.unauthorized('Not authenticated');
      }

      const createdUser = await userService.createUser(orgId, req.body);
      sendSuccess(res, createdUser, 'User created successfully. Please share their temporary password.', 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/v1/users/:id
   * Updates user role, status or details.
   */
  async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      const userId = req.params.id as string;
      if (!orgId) {
        throw ApiError.unauthorized('Not authenticated');
      }

      // Strict Authorization Check
      if (req.user?.role !== 'admin' && req.user?.role !== 'owner') {
        // Non-admins can only update their own profile
        if (req.user?.userId !== userId) {
          throw ApiError.forbidden('You can only update your own profile');
        }
        // Non-admins cannot elevate their own role or bypass suspension by changing status
        if (req.body.role || req.body.status) {
          throw ApiError.forbidden('Only admins can modify user roles and statuses');
        }
      }

      const updatedUser = await userService.updateUser(orgId, userId, req.body);
      sendSuccess(res, updatedUser, 'User profile updated successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/users/:id
   * Soft deactivates/deletes a user from the organization.
   */
  async deactivateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      const userId = req.params.id as string;
      if (!orgId) {
        throw ApiError.unauthorized('Not authenticated');
      }

      if (userId === req.user?.userId) {
        throw ApiError.badRequest('You cannot deactivate your own account');
      }

      await userService.deactivateUser(orgId, userId);
      sendSuccess(res, null, 'User deactivated successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/users/customer
   * Generates a customer login for a given contact.
   */
  async generateCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) {
        throw ApiError.unauthorized('Not authenticated');
      }

      const { contactId, email, password } = req.body;
      const user = await userService.generateCustomer(orgId, contactId, email, password);
      
      sendSuccess(res, user, 'Customer login generated successfully', 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/v1/users/me/password
   * Allows a user to change their own password
   */
  async updateMyPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      const userId = req.user?.userId;
      
      if (!orgId || !userId) {
        throw ApiError.unauthorized('Not authenticated');
      }

      await userService.updateUser(orgId, userId, { password: req.body.password });
      sendSuccess(res, null, 'Password updated successfully');
    } catch (error) {
      next(error);
    }
  },
};
