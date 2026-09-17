import type { Request, Response, NextFunction } from 'express';
import { invoiceService } from './invoice.service.js';
import { sendSuccess, sendPaginated } from '../../utils/api-response.js';
import { ApiError } from '../../utils/api-error.js';
import { generateInvoiceNumber } from '../../utils/invoice-number.js';
import { db } from '../../db/index.js';

export const invoiceController = {
  /**
   * GET /api/v1/invoices
   * Lists customer and vendor invoices.
   */
  async listInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const type = req.query.type as string | undefined;
      const status = req.query.status as string | undefined;
      const contactId = req.query.contactId as string | undefined;
      const orderId = req.query.orderId as string | undefined;
      const search = req.query.q as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const sortBy = req.query.sortBy as string | undefined;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;

      const result = await invoiceService.listInvoices(orgId, {
        type,
        status,
        contactId,
        orderId,
        search,
        startDate,
        endDate,
        page,
        limit,
        sortBy,
        sortOrder,
      });

      sendPaginated(
        res,
        result.data,
        result.pagination.total,
        result.pagination.page,
        result.pagination.limit,
        'Invoices list retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/invoices/next-number
   * Generates the next sequential invoice number.
   */
  async getNextInvoiceNumber(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const documentType = (req.query.type as any) || 'sales_invoice';
      const dateParam = req.query.date as string;
      const customPrefix = (req.query.prefix as string) || undefined;
      const targetDate = dateParam ? new Date(dateParam) : new Date();
      
      const number = await generateInvoiceNumber(db, orgId, documentType, targetDate, customPrefix);

      sendSuccess(res, { invoiceNumber: number }, 'Next invoice number generated');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/invoices/sequence-bounds
   * Fetches the previous and next invoice dates for a given invoice number.
   */
  async getSequenceBounds(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const documentType = (req.query.type as string) || 'sales_invoice';
      const invoiceNumber = req.query.invoiceNumber as string;
      
      if (!invoiceNumber) {
        throw ApiError.badRequest('invoiceNumber is required');
      }

      const bounds = await invoiceService.getSequenceBounds(orgId, documentType, invoiceNumber);
      sendSuccess(res, bounds, 'Sequence bounds retrieved');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/invoices/:id
   * Retrieves specific invoice details.
   */
  async getInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const invoice = await invoiceService.getInvoiceById(orgId, req.params.id as string);
      sendSuccess(res, invoice, 'Invoice profile retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/invoices
   * Creates a new invoice with nested line items.
   */
  async createInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      const userId = req.user?.userId;
      if (!orgId || !userId) throw ApiError.unauthorized('Not authenticated');

      const invoice = await invoiceService.createInvoice(orgId, userId, req.body);
      sendSuccess(res, invoice, 'Invoice generated successfully', 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/v1/invoices/:id
   * Updates fields or line items of an existing invoice.
   */
  async updateInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const invoice = await invoiceService.updateInvoice(orgId, req.params.id as string, req.body);
      sendSuccess(res, invoice, 'Invoice updated successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/invoices/:id
   * Cancels/soft deletes an invoice.
   */
  async deleteInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      await invoiceService.deleteInvoice(orgId, req.params.id as string);
      sendSuccess(res, null, 'Invoice cancelled successfully');
    } catch (error) {
      next(error);
    }
  },
};
