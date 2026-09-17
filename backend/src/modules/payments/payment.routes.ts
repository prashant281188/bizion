import { Router } from 'express';
import { paymentController } from './payment.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireMinRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  createPaymentSchema,
  createBankAccountSchema,
  updateBankAccountSchema,
  updatePaymentStatusSchema,
  bulkCreatePaymentSchema,
} from './payment.schema.js';

const router = Router();

// Apply auth globally to all payment and bank account routes
router.use(authenticate);

// ─── Bank Accounts Sub-routes ────────────────────────────────────────────────
router.get('/bank-accounts', paymentController.listBankAccounts);
router.get('/bank-accounts/:id', paymentController.getBankAccount);
router.get('/bank-accounts/:id/ledger', paymentController.getBankAccountLedger);

router.post(
  '/bank-accounts',
  requireMinRole('manager'),
  validate({ body: createBankAccountSchema }),
  paymentController.createBankAccount
);

router.put(
  '/bank-accounts/:id',
  requireMinRole('manager'),
  validate({ body: updateBankAccountSchema }),
  paymentController.updateBankAccount
);

router.delete(
  '/bank-accounts/:id',
  requireMinRole('admin'),
  paymentController.deleteBankAccount
);

// ─── Payments Main Routes ────────────────────────────────────────────────────
router.get('/next-number', paymentController.getNextPaymentNumber);
router.get('/', paymentController.listPayments);
router.post(
  '/bulk',
  requireMinRole('agent'),
  validate({ body: bulkCreatePaymentSchema }),
  paymentController.bulkCreatePayments
);
router.get('/:id', paymentController.getPaymentDetails);

router.post(
  '/',
  requireMinRole('agent'),
  validate({ body: createPaymentSchema }),
  paymentController.createPayment
);

router.delete(
  '/:id',
  requireMinRole('manager'),
  paymentController.deletePayment
);

router.patch(
  '/:id/status',
  requireMinRole('manager'),
  validate({ body: updatePaymentStatusSchema }),
  paymentController.updatePaymentStatus
);

export default router;
