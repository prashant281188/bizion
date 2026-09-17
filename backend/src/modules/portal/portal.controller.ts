import type { Request, Response, NextFunction } from 'express';
import { portalService } from './portal.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { ApiError } from '../../utils/api-error.js';

export const portalController = {
  async getOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      const contactId = req.user?.contactId;
      if (!orgId || !contactId) throw ApiError.unauthorized('Not authenticated or not a portal user');

      const data = await portalService.getOrders(orgId, contactId);
      sendSuccess(res, data, 'Orders retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async getInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      const contactId = req.user?.contactId;
      if (!orgId || !contactId) throw ApiError.unauthorized('Not authenticated or not a portal user');

      const data = await portalService.getInvoices(orgId, contactId);
      sendSuccess(res, data, 'Invoices retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async getPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      const contactId = req.user?.contactId;
      if (!orgId || !contactId) throw ApiError.unauthorized('Not authenticated or not a portal user');

      const data = await portalService.getPayments(orgId, contactId);
      sendSuccess(res, data, 'Payments retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async getProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      const contactId = req.user?.contactId;
      if (!orgId || !contactId) throw ApiError.unauthorized('Not authenticated or not a portal user');

      const data = await portalService.getProducts(orgId, contactId);
      sendSuccess(res, data, 'Products retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async getLedger(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      const contactId = req.user?.contactId;
      if (!orgId || !contactId) throw ApiError.unauthorized('Not authenticated or not a portal user');

      const { from, to } = req.query as { from?: string; to?: string };
      const data = await portalService.getLedger(orgId, contactId, from, to);
      sendSuccess(res, data, 'Ledger retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      const contactId = req.user?.contactId;
      if (!orgId || !contactId) throw ApiError.unauthorized('Not authenticated or not a portal user');

      const data = await portalService.getProfile(orgId, contactId);
      sendSuccess(res, data, 'Profile retrieved successfully');
    } catch (error) {
      next(error);
    }
  },
};
