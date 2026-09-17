import { Router } from 'express';
import { mastersController } from './masters.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireMinRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { setCacheControl } from '../../middleware/cache.middleware.js';
import {
  createCategorySchema,
  updateCategorySchema,
  createBrandSchema,
  updateBrandSchema,
  createUnitSchema,
  updateUnitSchema,
  createTaxRateSchema,
  updateTaxRateSchema,
  createPaymentTermSchema,
  updatePaymentTermSchema,
  createContactGroupSchema,
  updateContactGroupSchema,
  createHsnCodeSchema,
  updateHsnCodeSchema,
  updateHsnRateSchema,
} from './masters.schema.js';

const router = Router();

// Apply auth globally to all master routes
router.use(authenticate);

// Removed HTTP caching because React Query handles caching and we need immediate updates on mutation

// ─── Bootstrap ─────────────────────────────────────────────────────────────
router.get('/bootstrap', mastersController.bootstrap);

// ─── Categories ────────────────────────────────────────────────────────────
router.get('/categories', mastersController.listCategories);
router.get('/categories/:id', mastersController.getCategory);
router.post(
  '/categories',
  requireMinRole('admin'),
  validate({ body: createCategorySchema }),
  mastersController.createCategory
);
router.put(
  '/categories/:id',
  requireMinRole('admin'),
  validate({ body: updateCategorySchema }),
  mastersController.updateCategory
);
router.delete('/categories/:id', requireMinRole('admin'), mastersController.deleteCategory);

// ─── Brands ────────────────────────────────────────────────────────────────
router.get('/brands', mastersController.listBrands);
router.get('/brands/:id', mastersController.getBrand);
router.post(
  '/brands',
  requireMinRole('admin'),
  validate({ body: createBrandSchema }),
  mastersController.createBrand
);
router.put(
  '/brands/:id',
  requireMinRole('admin'),
  validate({ body: updateBrandSchema }),
  mastersController.updateBrand
);
router.delete('/brands/:id', requireMinRole('admin'), mastersController.deleteBrand);

// ─── Units ─────────────────────────────────────────────────────────────────
router.get('/units', mastersController.listUnits);
router.get('/units/:id', mastersController.getUnit);
router.post(
  '/units',
  requireMinRole('admin'),
  validate({ body: createUnitSchema }),
  mastersController.createUnit
);
router.put(
  '/units/:id',
  requireMinRole('admin'),
  validate({ body: updateUnitSchema }),
  mastersController.updateUnit
);
router.delete('/units/:id', requireMinRole('admin'), mastersController.deleteUnit);

// ─── Tax Rates ─────────────────────────────────────────────────────────────
router.get('/tax-rates', mastersController.listTaxRates);
router.get('/tax-rates/:id', mastersController.getTaxRate);
router.post(
  '/tax-rates',
  requireMinRole('admin'),
  validate({ body: createTaxRateSchema }),
  mastersController.createTaxRate
);
router.put(
  '/tax-rates/:id',
  requireMinRole('admin'),
  validate({ body: updateTaxRateSchema }),
  mastersController.updateTaxRate
);
router.delete('/tax-rates/:id', requireMinRole('admin'), mastersController.deleteTaxRate);

// ─── Payment Terms ──────────────────────────────────────────────────────────
router.get('/payment-terms', mastersController.listPaymentTerms);
router.get('/payment-terms/:id', mastersController.getPaymentTerm);
router.post(
  '/payment-terms',
  requireMinRole('admin'),
  validate({ body: createPaymentTermSchema }),
  mastersController.createPaymentTerm
);
router.put(
  '/payment-terms/:id',
  requireMinRole('admin'),
  validate({ body: updatePaymentTermSchema }),
  mastersController.updatePaymentTerm
);
router.delete('/payment-terms/:id', requireMinRole('admin'), mastersController.deletePaymentTerm);

// ─── HSN / SAC Codes ─────────────────────────────────────────────────────────
router.get('/hsn-codes', mastersController.listHsnCodes);
router.get('/hsn-codes/:id', mastersController.getHsnCode);
router.post(
  '/hsn-codes',
  requireMinRole('admin'),
  validate({ body: createHsnCodeSchema }),
  mastersController.createHsnCode
);
router.put(
  '/hsn-codes/:id',
  requireMinRole('admin'),
  validate({ body: updateHsnCodeSchema }),
  mastersController.updateHsnCode
);
router.put(
  '/hsn-codes/:id/rate',
  requireMinRole('admin'),
  validate({ body: updateHsnRateSchema }),
  mastersController.updateHsnRate
);
router.get('/hsn-codes/:id/rate-history', mastersController.getHsnRateHistory);
router.delete('/hsn-codes/:id', requireMinRole('admin'), mastersController.deleteHsnCode);

// ─── Contact Groups ──────────────────────────────────────────────────────────
router.get('/contact-groups', mastersController.listContactGroups);
router.get('/contact-groups/:id', mastersController.getContactGroup);
router.post(
  '/contact-groups',
  requireMinRole('admin'),
  validate({ body: createContactGroupSchema }),
  mastersController.createContactGroup
);
router.put(
  '/contact-groups/:id',
  requireMinRole('admin'),
  validate({ body: updateContactGroupSchema }),
  mastersController.updateContactGroup
);
router.delete('/contact-groups/:id', requireMinRole('admin'), mastersController.deleteContactGroup);

export default router;
