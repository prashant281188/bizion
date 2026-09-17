import { Router } from 'express';
import { contactController } from './contact.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireMinRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { createContactSchema, updateContactSchema, addressSchema, createBulkContactSchema } from './contact.schema.js';

const router = Router();

// Apply auth globally to all contact routes
router.use(authenticate);

// ─── Contact Directory Routes ───────────────────────────────────────────────
router.get('/', requireMinRole('agent'), contactController.listContacts);
router.get('/:id', requireMinRole('agent'), contactController.getContact);
router.get('/:id/analytics', requireMinRole('agent'), contactController.getAnalytics);
router.get('/:id/access', requireMinRole('agent'), contactController.getAccess);
router.post('/:id/access', requireMinRole('agent'), contactController.manageAccess);

router.post(
  '/bulk',
  requireMinRole('agent'),
  validate({ body: createBulkContactSchema }),
  contactController.createBulkContacts
);

router.post(
  '/',
  requireMinRole('agent'),
  validate({ body: createContactSchema }),
  contactController.createContact
);

router.put(
  '/:id',
  requireMinRole('agent'),
  validate({ body: updateContactSchema }),
  contactController.updateContact
);

router.patch(
  '/:id/status',
  requireMinRole('manager'),
  contactController.toggleStatus
);

router.delete(
  '/:id',
  requireMinRole('manager'),
  contactController.deleteContact
);

// ─── Contact Address Sub-routes ──────────────────────────────────────────────
router.post(
  '/:id/addresses',
  requireMinRole('agent'),
  validate({ body: addressSchema }),
  contactController.addAddress
);

router.put(
  '/:id/addresses/:addressId',
  requireMinRole('agent'),
  validate({ body: addressSchema.partial() }),
  contactController.updateAddress
);

router.delete(
  '/:id/addresses/:addressId',
  requireMinRole('agent'),
  contactController.deleteAddress
);

// ─── Contact Custom Pricing Sub-routes ───────────────────────────────────────
router.get('/:id/prices', contactController.listCustomPrices);

router.post(
  '/:id/prices',
  requireMinRole('agent'),
  contactController.setCustomPrice
);

router.delete(
  '/:id/prices/:priceId',
  requireMinRole('agent'),
  contactController.deleteCustomPrice
);

export default router;
