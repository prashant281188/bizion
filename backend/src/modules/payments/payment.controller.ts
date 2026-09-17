import type { Request, Response, NextFunction } from 'express';
import { paymentService } from './payment.service.js';
import { sendSuccess, sendPaginated } from '../../utils/api-response.js';
import { parsePagination } from '../../utils/pagination.js';
import { db } from '../../config/database.js';
import { generatePaymentNumber } from '../../utils/payment-number.js';

export class PaymentController {
  // ─── Bank Accounts ─────────────────────────────────────────────────────────

  async listBankAccounts(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const accounts = await paymentService.listBankAccounts(orgId);
      sendSuccess(res, accounts, 'Bank accounts retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getBankAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const id = req.params.id as string;
      const account = await paymentService.getBankAccount(orgId, id);
      sendSuccess(res, account, 'Bank account retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getBankAccountLedger(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const id = req.params.id as string;
      const result = await paymentService.getBankAccountLedger(orgId, id);
      sendSuccess(res, result, 'Bank account ledger retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async createBankAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const account = await paymentService.createBankAccount(orgId, req.body);
      sendSuccess(res, account, 'Bank account created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async updateBankAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const id = req.params.id as string;
      const account = await paymentService.updateBankAccount(orgId, id, req.body);
      sendSuccess(res, account, 'Bank account updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteBankAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const id = req.params.id as string;
      await paymentService.deleteBankAccount(orgId, id);
      sendSuccess(res, null, 'Bank account deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  // ─── Payments ──────────────────────────────────────────────────────────────

  async getNextPaymentNumber(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const direction = (req.query.direction as any) || 'inbound';
      const dateParam = req.query.date as string;
      const customPrefix = (req.query.prefix as string) || undefined;
      const targetDate = dateParam ? new Date(dateParam) : new Date();
      
      const number = await generatePaymentNumber(db, orgId, direction, targetDate, customPrefix);

      sendSuccess(res, { paymentNumber: number }, 'Next payment number generated');
    } catch (error) {
      next(error);
    }
  }

  async listPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const { page, limit } = parsePagination(req.query);
      const direction = req.query.direction as 'inbound' | 'outbound' | undefined;
      const contactId = req.query.contactId as string | undefined;
      const status = req.query.status as string | undefined;
      const q = req.query.q as string | undefined;
      const sortBy = req.query.sortBy as string | undefined;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const result = await paymentService.listPayments(orgId, {
        page,
        limit,
        direction,
        contactId,
        status,
        q,
        sortBy,
        sortOrder,
        startDate,
        endDate,
      });

      sendPaginated(
        res,
        result.data,
        result.pagination.total,
        result.pagination.page,
        result.pagination.limit,
        'Payments retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  async getPaymentDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const id = req.params.id as string;
      const payment = await paymentService.getPaymentDetails(orgId, id);
      sendSuccess(res, payment, 'Payment details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async createPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const userId = req.user!.userId;
      const payment = await paymentService.createPayment(orgId, userId, req.body);
      sendSuccess(res, payment, 'Payment recorded successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async bulkCreatePayments(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const userId = req.user!.userId;
      const { payments } = req.body;
      const results = await paymentService.bulkCreatePayments(orgId, userId, payments);
      sendSuccess(res, results, 'Bulk payments processed', 201);
    } catch (error) {
      next(error);
    }
  }

  async deletePayment(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const id = req.params.id as string;
      const payment = await paymentService.deletePayment(orgId, id);
      sendSuccess(res, payment, 'Payment cancelled successfully');
    } catch (error) {
      next(error);
    }
  }

  async updatePaymentStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const userId = req.user!.userId;
      const id = req.params.id as string;
      const payment = await paymentService.updatePaymentStatus(orgId, id, req.body, userId);
      sendSuccess(res, payment, 'Payment updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const paymentController = new PaymentController();

