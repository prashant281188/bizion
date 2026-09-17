import type { Request, Response, NextFunction } from 'express';
import { orgService } from './org.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { ApiError } from '../../utils/api-error.js';

export const orgController = {
  /**
   * GET /api/v1/organizations/me
   * Fetches the organization profile of the currently logged-in user.
   */
  async getOrg(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) {
        throw ApiError.unauthorized('Not authenticated');
      }

      const org = await orgService.getOrgById(orgId);
      sendSuccess(res, org, 'Organization details retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/v1/organizations/me
   * Updates the organization profile (accessible only by admin or owner).
   */
  async updateOrg(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) {
        throw ApiError.unauthorized('Not authenticated');
      }

      const updatedOrg = await orgService.updateOrg(orgId, req.body);
      sendSuccess(res, updatedOrg, 'Organization profile updated successfully');
    } catch (error) {
      next(error);
    }
  },
};
