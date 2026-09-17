import type { Request, Response, NextFunction } from 'express';
import { reportsService } from './reports.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { ApiError } from '../../utils/api-error.js';

export const reportsController = {
  async getGstr1Report(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const from = req.query.from ? new Date(req.query.from as string) : undefined;
      const to = req.query.to ? new Date(req.query.to as string) : undefined;

      const report = await reportsService.getGstr1Report(orgId, from, to);
      sendSuccess(res, report, 'GSTR-1 report generated successfully');
    } catch (error) {
      next(error);
    }
  },

  async getGstr3bReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const from = req.query.from ? new Date(req.query.from as string) : undefined;
      const to = req.query.to ? new Date(req.query.to as string) : undefined;

      const report = await reportsService.getGstr3bReport(orgId, from, to);
      sendSuccess(res, report, 'GSTR-3B report generated successfully');
    } catch (error) {
      next(error);
    }
  },

  async getHsnSummaryReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const from = req.query.from ? new Date(req.query.from as string) : undefined;
      const to = req.query.to ? new Date(req.query.to as string) : undefined;

      const report = await reportsService.getHsnSummaryReport(orgId, from, to);
      sendSuccess(res, report, 'HSN Summary report generated successfully');
    } catch (error) {
      next(error);
    }
  },

  async getProfitLossReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const from = req.query.from ? new Date(req.query.from as string) : undefined;
      const to = req.query.to ? new Date(req.query.to as string) : undefined;

      const report = await reportsService.getProfitLossReport(orgId, from, to);
      sendSuccess(res, report, 'Profit & Loss statement generated successfully');
    } catch (error) {
      next(error);
    }
  },

  async getBalanceSheetReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const date = req.query.date ? new Date(req.query.date as string) : new Date();

      const report = await reportsService.getBalanceSheetReport(orgId, date);
      sendSuccess(res, report, 'Balance sheet generated successfully');
    } catch (error) {
      next(error);
    }
  },

  async getSalesSummaryReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const from = req.query.from ? new Date(req.query.from as string) : undefined;
      const to = req.query.to ? new Date(req.query.to as string) : undefined;

      const report = await reportsService.getSalesSummaryReport(orgId, from, to);
      sendSuccess(res, report, 'Sales summary generated successfully');
    } catch (error) {
      next(error);
    }
  },

  async getReceivablesReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const report = await reportsService.getReceivablesReport(orgId);
      sendSuccess(res, report, 'Receivables report generated successfully');
    } catch (error) {
      next(error);
    }
  },

  async getPayablesReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const report = await reportsService.getPayablesReport(orgId);
      sendSuccess(res, report, 'Payables report generated successfully');
    } catch (error) {
      next(error);
    }
  },
  async getDashboardStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');
      const stats = await reportsService.getDashboardStats(orgId);
      sendSuccess(res, stats, 'Dashboard stats retrieved');
    } catch (error) {
      next(error);
    }
  },
};
