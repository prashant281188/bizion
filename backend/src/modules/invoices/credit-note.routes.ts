import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireMinRole } from '../../middleware/rbac.middleware.js';
import { creditNoteService } from './credit-note.service.js';
import { ApiError } from '../../utils/api-error.js';

const router = Router();
router.use(authenticate);

/**
 * GET /api/v1/credit-notes/available?contactId=...
 * Returns all credit notes with remaining balance for a given customer.
 */
router.get('/available', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;
    const contactId = req.query.contactId as string;
    if (!contactId) throw new ApiError(400, 'contactId is required');
    const result = await creditNoteService.getAvailableCredits(orgId, contactId);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/credit-notes/available-debits?contactId=...
 * Returns all debit notes with remaining balance for a given supplier.
 */
router.get('/available-debits', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;
    const contactId = req.query.contactId as string;
    if (!contactId) throw new ApiError(400, 'contactId is required');
    const result = await creditNoteService.getAvailableDebits(orgId, contactId);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/credit-notes/:id/apply
 * Apply a credit note to an invoice.
 */
router.post('/:id/apply', requireMinRole('accountant'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;
    const userId = (req as any).user.id;
    const creditNoteId = req.params.id as string;
    const { invoiceId, amountApplied, appliedDate, notes } = req.body;

    if (!invoiceId || !amountApplied || !appliedDate) {
      throw new ApiError(400, 'invoiceId, amountApplied, and appliedDate are required');
    }

    const result = await creditNoteService.applyCreditNote(orgId, userId, {
      creditNoteId,
      invoiceId,
      amountApplied: Number(amountApplied),
      appliedDate,
      notes,
    });

    res.status(201).json({ data: result, message: 'Credit note applied successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/credit-notes/:id/apply-debit
 * Apply a debit note to a purchase invoice.
 */
router.post('/:id/apply-debit', requireMinRole('accountant'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;
    const userId = (req as any).user.id;
    const debitNoteId = req.params.id as string;
    const { invoiceId, amountApplied, appliedDate, notes } = req.body;

    if (!invoiceId || !amountApplied || !appliedDate) {
      throw new ApiError(400, 'invoiceId, amountApplied, and appliedDate are required');
    }

    const result = await creditNoteService.applyDebitNote(orgId, userId, {
      debitNoteId,
      invoiceId,
      amountApplied: Number(amountApplied),
      appliedDate,
      notes,
    });

    res.status(201).json({ data: result, message: 'Debit note applied successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/credit-notes/:id/allocations
 * List all applications of a specific credit note.
 */
router.get('/:id/allocations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;
    const result = await creditNoteService.listAllocations(orgId, req.params.id as string);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/credit-notes/invoice-allocations/:invoiceId
 * List all credit notes applied to a specific invoice.
 */
router.get('/invoice-allocations/:invoiceId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;
    const result = await creditNoteService.listAllocationsForInvoice(orgId, req.params.invoiceId as string);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/credit-notes/allocations/:id
 * Remove (void) a specific credit note allocation.
 */
router.delete('/allocations/:id', requireMinRole('manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;
    const result = await creditNoteService.removeAllocation(orgId, req.params.id as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
