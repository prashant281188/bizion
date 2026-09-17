import { Router } from 'express';
import { productController } from './product.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireMinRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { z } from 'zod';
import { createProductSchema, updateProductSchema } from './product.schema.js';
import { redisCacheMiddleware } from '../../middleware/redis-cache.middleware.js';
import { readLimiter } from '../../middleware/rate-limit.middleware.js';

const router = Router();

// ─── Public Catalog Routes (Guest View, No Auth Required) ────────────────────
router.use('/public', readLimiter);
router.get('/public/:orgSlug/products', redisCacheMiddleware(300), productController.listPublicProducts);
router.get('/public/:orgSlug/promotions', redisCacheMiddleware(300), productController.listPublicPromotions);
router.get('/public/:orgSlug/catalog-pdf', productController.downloadCatalogPdf);
router.get('/public/:orgSlug/price-list-pdf', productController.downloadPriceListPdf);
router.get('/public/:orgSlug/attributes', redisCacheMiddleware(300), productController.listPublicAttributes);
router.get('/public/:orgSlug/products/:productSlug', redisCacheMiddleware(300), productController.getPublicProduct);
router.get('/public/:orgSlug/organization', redisCacheMiddleware(300), productController.getPublicOrganization);
router.get('/public/:orgSlug/categories', redisCacheMiddleware(300), productController.listPublicCategories);
router.get('/public/:orgSlug/brands', redisCacheMiddleware(300), productController.listPublicBrands);

// ─── Private Administrative Routes (Requires Authentication) ─────────────────
// NOTE: Specific named routes MUST come before parameterized /:id routes
router.get('/', authenticate, productController.listProducts);
router.get('/attributes', authenticate, productController.listAttributes);
router.get('/bulk-pricing', authenticate, productController.listBulkPricing);
router.get('/variants/:variantId/price-history', authenticate, productController.getVariantPriceHistory);
router.get('/overview/analytics', authenticate, productController.getGlobalAnalytics);
router.get('/price-revisions', authenticate, productController.getPriceRevisions);
router.get('/:id/analytics', authenticate, productController.getProductAnalytics);
router.get('/:id/price-history', authenticate, productController.getProductPriceHistory);
router.get('/:id', authenticate, productController.getProduct);

router.post(
  '/bulk',
  authenticate,
  requireMinRole('manager'),
  validate({ body: z.object({ products: z.array(z.any()) }) }), // Let the controller/service handle deep validation for now or use bulkCreateProductsSchema
  productController.bulkCreateProducts
);

router.post(
  '/',
  authenticate,
  requireMinRole('manager'),
  validate({ body: createProductSchema }),
  productController.createProduct
);

router.put(
  '/:id',
  authenticate,
  requireMinRole('manager'),
  validate({ body: updateProductSchema }),
  productController.updateProduct
);

router.delete(
  '/:id',
  authenticate,
  requireMinRole('manager'),
  productController.deleteProduct
);

router.patch(
  '/bulk-pricing',
  authenticate,
  requireMinRole('manager'),
  productController.bulkUpdatePricing
);

export default router;
