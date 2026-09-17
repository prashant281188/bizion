import { Router } from 'express';
import { invoiceController } from './invoice.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireMinRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { createInvoiceSchema, updateInvoiceSchema } from './invoice.schema.js';

const router = Router();

router.use(authenticate);

router.get('/', requireMinRole('agent'), invoiceController.listInvoices);
router.get('/next-number', requireMinRole('agent'), invoiceController.getNextInvoiceNumber);
router.get('/sequence-bounds', requireMinRole('agent'), invoiceController.getSequenceBounds);
router.get('/:id', requireMinRole('agent'), invoiceController.getInvoice);

router.post(
  '/',
  requireMinRole('agent'),
  validate({ body: createInvoiceSchema }),
  invoiceController.createInvoice
);

router.put(
  '/:id',
  requireMinRole('agent'),
  validate({ body: updateInvoiceSchema }),
  invoiceController.updateInvoice
);

router.delete(
  '/:id',
  requireMinRole('manager'),
  invoiceController.deleteInvoice
);

export default router;
