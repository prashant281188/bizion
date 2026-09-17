import type { Request, Response, NextFunction } from 'express';
import { productService } from './product.service.js';
import { sendSuccess, sendPaginated } from '../../utils/api-response.js';
import { cacheService } from '../../utils/cache.js';
import { ApiError } from '../../utils/api-error.js';

export const productController = {
  async getPriceRevisions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const data = await productService.getPriceRevisions(orgId);
      sendSuccess(res, data, 'Price revisions retrieved successfully');
    } catch (error) {
      next(error);
    }
  },
  /**
   * GET /api/v1/products
   * Retrieves products with pagination, search, and filtering by category/brand.
   */
  async listProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const categoryId = req.query.categoryId as string | undefined;
      const brandId = req.query.brandId as string | undefined;
      const status = req.query.status as string | undefined;
      const type = req.query.type as string | undefined;
      const search = req.query.q as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const sortBy = req.query.sortBy as string | undefined;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;
      const flattenVariants = req.query.flattenVariants === 'true';

      const result = await productService.listProducts(orgId, {
        categoryId,
        brandId,
        status,
        type,
        search,
        page,
        limit,
        sortBy,
        sortOrder,
        flattenVariants,
      });

      sendPaginated(res, result.data, result.pagination.total, result.pagination.page, result.pagination.limit, 'Products list retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/products/:id
   * Retrieves product details including all variants and S3 images.
   */
  async getProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const product = await productService.getProductById(orgId, req.params.id as string);
      sendSuccess(res, product, 'Product details retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/products/overview/analytics
   * Retrieves global product analytics.
   */
  async getGlobalAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const analytics = await productService.getGlobalAnalytics(orgId, page, limit);
      sendSuccess(res, analytics, 'Global product analytics retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/products/:id/analytics
   * Retrieves product analytics (sales/purchase history & insights).
   */
  async getProductAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const variantId = req.query.variantId as string | undefined;

      const analytics = await productService.getProductAnalytics(orgId, req.params.id as string, variantId);
      sendSuccess(res, analytics, 'Product analytics retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/products
   * Creates a new product with optional variants.
   */
  async bulkCreateProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      const userId = req.user?.userId;
      if (!orgId || !userId) throw ApiError.unauthorized('Not authenticated');

      const input = req.body.products as any[];
      if (!Array.isArray(input) || input.length === 0) {
        throw ApiError.badRequest('Products array is required');
      }

      const result = await productService.bulkCreateProducts(orgId, userId, input);

      sendSuccess(res, result, 'Bulk products processed', 201);
    } catch (error) {
      next(error);
    }
  },

  async createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      const userId = req.user?.userId;
      if (!orgId || !userId) throw ApiError.unauthorized('Not authenticated');

      const product = await productService.createProduct(orgId, userId, req.body);
      await cacheService.invalidatePattern('cache:/api/v1/products/public/*');
      sendSuccess(res, product, 'Product created successfully', 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/v1/products/:id
   * Updates an existing product and synchronizes variants.
   */
  async updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      const userId = req.user?.userId;
      if (!orgId || !userId) throw ApiError.unauthorized('Not authenticated');

      const product = await productService.updateProduct(orgId, req.params.id as string, userId, req.body);
      await cacheService.invalidatePattern('cache:/api/v1/products/public/*');
      sendSuccess(res, product, 'Product updated successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/products/:id
   * Soft-deletes a product and its variants.
   */
  async deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      await productService.deleteProduct(orgId, req.params.id as string);
      await cacheService.invalidatePattern('cache:/api/v1/products/public/*');
      sendSuccess(res, null, 'Product deleted successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/products/public/:orgSlug/catalog-pdf
   * Generates and streams a PDF catalog for the public organization.
   */
  async downloadCatalogPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgSlug = req.params.orgSlug as string;
      const categoryId = req.query.categoryId as string | undefined;
      const brandId = req.query.brandId as string | undefined;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="catalog-${orgSlug}.pdf"`);

      await productService.generateCatalogPdfStream(orgSlug, { categoryId, brandId }, res);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/products/public/:orgSlug/price-list-pdf
   * Generates and streams a PDF price list (rates & packing info only) for the organization.
   */
  async downloadPriceListPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgSlug = req.params.orgSlug as string;
      const categoryId = req.query.categoryId as string | undefined;
      const brandId = req.query.brandId as string | undefined;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="price-list-${orgSlug}.pdf"`);

      await productService.generatePriceListPdfStream(orgSlug, { categoryId, brandId }, res);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/products/public/:orgSlug/attributes
   * Retrieves available public attributes for the organization.
   */
  async listPublicAttributes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgSlug = req.params.orgSlug as string;
      const categoryId = req.query.categoryId as string | undefined;
      const attributes = await productService.listPublicAttributes(orgSlug, categoryId);
      sendSuccess(res, attributes, 'Public attributes retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/products/public/:orgSlug/products
   * Retrieves products for public guest view by organization slug.
   */
  async listPublicProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgSlug = req.params.orgSlug as string;
      const categoryId = req.query.categoryId as string | undefined;
      const brandId = req.query.brandId as string | undefined;
      const search = req.query.q as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      let limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 12;
      
      // Enforce a hard upper bound on the limit to prevent resource exhaustion DoS
      limit = Math.min(Math.max(1, limit), 100);

      const sortBy = req.query.sortBy as string | undefined;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;

      // Extract attribute filters
      const attributes: Record<string, string> = {};
      for (const [key, val] of Object.entries(req.query)) {
        if (key.startsWith('attr_') && typeof val === 'string') {
          const attrKey = key.replace('attr_', '');
          attributes[attrKey] = val;
        }
      }

      const result = await productService.listPublicProducts(orgSlug, {
        categoryId,
        brandId,
        search,
        page,
        limit,
        sortBy,
        sortOrder,
        attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
      });

      sendPaginated(res, result.data, result.pagination.total, result.pagination.page, result.pagination.limit, 'Public products list retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/products/public/:orgSlug/products/:productSlug
   * Retrieves details for a single product by slug under guest view.
   */
  async getPublicProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgSlug = req.params.orgSlug as string;
      const productSlug = req.params.productSlug as string;

      const product = await productService.getPublicProductBySlug(orgSlug, productSlug);
      sendSuccess(res, product, 'Public product details retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/products/public/:orgSlug/organization
   * Retrieves public details of the organization by slug.
   */
  async getPublicOrganization(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgSlug = req.params.orgSlug as string;
      const org = await productService.getPublicOrganization(orgSlug);
      sendSuccess(res, org, 'Public organization details retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/products/public/:orgSlug/promotions
   * Retrieves active promotional schemes (Special Offers, Clearance Sales, etc.) for storefront display.
   */
  async listPublicPromotions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgSlug = req.params.orgSlug as string;
      const promos = await productService.listPublicPromotions(orgSlug);
      sendSuccess(res, promos, 'Public promotions retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/products/public/:orgSlug/categories
   * Retrieves categories under an organization slug for guest view.
   */
  async listPublicCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgSlug = req.params.orgSlug as string;
      const categories = await productService.listPublicCategories(orgSlug);
      sendSuccess(res, categories, 'Public categories list retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/products/public/:orgSlug/brands
   * Retrieves brands under an organization slug for guest view.
   */
  async listPublicBrands(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgSlug = req.params.orgSlug as string;
      const brands = await productService.listPublicBrands(orgSlug);
      sendSuccess(res, brands, 'Public brands list retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/products/attributes
   * Retrieves all distinct attribute keys used in the organization's variants.
   */
  async listAttributes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const attributes = await productService.listAttributes(orgId);
      sendSuccess(res, attributes, 'Variant attributes retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/products/variants/:variantId/price-history
   * Retrieves the price history timeline for a product variant.
   */
  async getVariantPriceHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const variantId = req.params.variantId as string;
      const history = await productService.getVariantPriceHistory(orgId, variantId);
      sendSuccess(res, history, 'Variant price history retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/products/:id/price-history
   * Retrieves the price history timeline for a base product (non-variant).
   */
  async getProductPriceHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const productId = req.params.id as string;
      const history = await productService.getProductPriceHistory(orgId, productId);
      sendSuccess(res, history, 'Product price history retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/products/bulk-pricing
   * Lists all products with variants for bulk pricing editor.
   */
  async listBulkPricing(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const search = req.query.q as string | undefined;
      const categoryId = req.query.categoryId as string | undefined;
      const brandId = req.query.brandId as string | undefined;

      const data = await productService.listProductsForBulkPricing(orgId, { search, categoryId, brandId });
      sendSuccess(res, data, 'Products for bulk pricing retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/products/bulk-pricing
   * Bulk updates pricing for multiple product variants.
   */
  async bulkUpdatePricing(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      const userId = req.user?.userId;
      if (!orgId || !userId) throw ApiError.unauthorized('Not authenticated');

      const { productUpdates, variantUpdates } = req.body;
      const pLen = Array.isArray(productUpdates) ? productUpdates.length : 0;
      const vLen = Array.isArray(variantUpdates) ? variantUpdates.length : 0;

      if (pLen === 0 && vLen === 0) {
        throw ApiError.badRequest('Must provide either productUpdates or variantUpdates');
      }

      const result = await productService.bulkUpdatePricing(orgId, userId, { productUpdates, variantUpdates });
      sendSuccess(res, result, `Updated pricing for ${result.updated} item(s)`);
    } catch (error) {
      next(error);
    }
  },
};
