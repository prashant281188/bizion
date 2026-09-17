import type { Request, Response, NextFunction } from 'express';
import { mastersService } from './masters.service.js';
import { sendSuccess, sendPaginated } from '../../utils/api-response.js';
import { cacheService } from '../../utils/cache.js';
import { ApiError } from '../../utils/api-error.js';

export const mastersController = {
  // ─── Bootstrap ─────────────────────────────────────────────────────────────
  async bootstrap(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const data = await mastersService.bootstrap(orgId);
      sendSuccess(res, data, 'Bootstrap data retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  // ─── Categories ────────────────────────────────────────────────────────────
  async listCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const sortBy = req.query.sortBy as string;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc';
      const search = req.query.q as string;

      const result = await mastersService.listCategories(orgId, { page, limit, sortBy, sortOrder, search });
      sendPaginated(res, result.data, result.pagination.total, result.pagination.page, result.pagination.limit, 'Categories retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async getCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const data = await mastersService.getCategoryById(orgId, req.params.id as string);
      sendSuccess(res, data, 'Category retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const data = await mastersService.createCategory(orgId, req.body);
      await cacheService.invalidatePattern('cache:/api/v1/products/public/*');
      sendSuccess(res, data, 'Category created successfully', 201);
    } catch (error) {
      next(error);
    }
  },

  async updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const data = await mastersService.updateCategory(orgId, req.params.id as string, req.body);
      await cacheService.invalidatePattern('cache:/api/v1/products/public/*');
      sendSuccess(res, data, 'Category updated successfully');
    } catch (error) {
      next(error);
    }
  },

  async deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      await mastersService.deleteCategory(orgId, req.params.id as string);
      await cacheService.invalidatePattern('cache:/api/v1/products/public/*');
      sendSuccess(res, null, 'Category deleted successfully');
    } catch (error) {
      next(error);
    }
  },

  // ─── Brands ────────────────────────────────────────────────────────────────
  async listBrands(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const sortBy = req.query.sortBy as string;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc';
      const search = req.query.q as string;

      const result = await mastersService.listBrands(orgId, { page, limit, sortBy, sortOrder, search });
      sendPaginated(res, result.data, result.pagination.total, result.pagination.page, result.pagination.limit, 'Brands retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async getBrand(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const data = await mastersService.getBrandById(orgId, req.params.id as string);
      sendSuccess(res, data, 'Brand retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async createBrand(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const data = await mastersService.createBrand(orgId, req.body);
      await cacheService.invalidatePattern('cache:/api/v1/products/public/*');
      sendSuccess(res, data, 'Brand created successfully', 201);
    } catch (error) {
      next(error);
    }
  },

  async updateBrand(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const data = await mastersService.updateBrand(orgId, req.params.id as string, req.body);
      await cacheService.invalidatePattern('cache:/api/v1/products/public/*');
      sendSuccess(res, data, 'Brand updated successfully');
    } catch (error) {
      next(error);
    }
  },

  async deleteBrand(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      await mastersService.deleteBrand(orgId, req.params.id as string);
      await cacheService.invalidatePattern('cache:/api/v1/products/public/*');
      sendSuccess(res, null, 'Brand deleted successfully');
    } catch (error) {
      next(error);
    }
  },

  // ─── Units ─────────────────────────────────────────────────────────────────
  async listUnits(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const sortBy = req.query.sortBy as string;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc';
      const search = req.query.q as string;

      const result = await mastersService.listUnits(orgId, { page, limit, sortBy, sortOrder, search });
      sendPaginated(res, result.data, result.pagination.total, result.pagination.page, result.pagination.limit, 'Units of measurement retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async getUnit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const data = await mastersService.getUnitById(orgId, req.params.id as string);
      sendSuccess(res, data, 'Unit of measurement retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async createUnit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const data = await mastersService.createUnit(orgId, req.body);
      sendSuccess(res, data, 'Unit of measurement created successfully', 201);
    } catch (error) {
      next(error);
    }
  },

  async updateUnit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const data = await mastersService.updateUnit(orgId, req.params.id as string, req.body);
      sendSuccess(res, data, 'Unit of measurement updated successfully');
    } catch (error) {
      next(error);
    }
  },

  async deleteUnit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      await mastersService.deleteUnit(orgId, req.params.id as string);
      sendSuccess(res, null, 'Unit of measurement deleted successfully');
    } catch (error) {
      next(error);
    }
  },

  // ─── Tax Rates ─────────────────────────────────────────────────────────────
  async listTaxRates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const sortBy = req.query.sortBy as string;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc';
      const search = req.query.q as string;

      const result = await mastersService.listTaxRates(orgId, { page, limit, sortBy, sortOrder, search });
      sendPaginated(res, result.data, result.pagination.total, result.pagination.page, result.pagination.limit, 'Tax rates retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async getTaxRate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const data = await mastersService.getTaxRateById(orgId, req.params.id as string);
      sendSuccess(res, data, 'Tax rate retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async createTaxRate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const data = await mastersService.createTaxRate(orgId, req.body);
      sendSuccess(res, data, 'Tax rate created successfully', 201);
    } catch (error) {
      next(error);
    }
  },

  async updateTaxRate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const data = await mastersService.updateTaxRate(orgId, req.params.id as string, req.body);
      sendSuccess(res, data, 'Tax rate updated successfully');
    } catch (error) {
      next(error);
    }
  },

  async deleteTaxRate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      await mastersService.deleteTaxRate(orgId, req.params.id as string);
      sendSuccess(res, null, 'Tax rate deleted successfully');
    } catch (error) {
      next(error);
    }
  },

  // ─── Payment Terms ──────────────────────────────────────────────────────────
  async listPaymentTerms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const sortBy = req.query.sortBy as string;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc';
      const search = req.query.q as string;

      const result = await mastersService.listPaymentTerms(orgId, { page, limit, sortBy, sortOrder, search });
      sendPaginated(res, result.data, result.pagination.total, result.pagination.page, result.pagination.limit, 'Payment terms retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async getPaymentTerm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const data = await mastersService.getPaymentTermById(orgId, req.params.id as string);
      sendSuccess(res, data, 'Payment term retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async createPaymentTerm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const data = await mastersService.createPaymentTerm(orgId, req.body);
      sendSuccess(res, data, 'Payment term created successfully', 201);
    } catch (error) {
      next(error);
    }
  },

  async updatePaymentTerm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const data = await mastersService.updatePaymentTerm(orgId, req.params.id as string, req.body);
      sendSuccess(res, data, 'Payment term updated successfully');
    } catch (error) {
      next(error);
    }
  },

  async deletePaymentTerm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      await mastersService.deletePaymentTerm(orgId, req.params.id as string);
      sendSuccess(res, null, 'Payment term deleted successfully');
    } catch (error) {
      next(error);
    }
  },

  // ─── HSN / SAC Codes ─────────────────────────────────────────────────────────
  async listHsnCodes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const sortBy = req.query.sortBy as string;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc';
      const search = req.query.q as string;

      const result = await mastersService.listHsnCodes(orgId, { page, limit, sortBy, sortOrder, search });
      sendPaginated(res, result.data, result.pagination.total, result.pagination.page, result.pagination.limit, 'HSN/SAC codes list retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async getHsnCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const data = await mastersService.getHsnCodeById(orgId, req.params.id as string);
      sendSuccess(res, data, 'HSN/SAC code retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async createHsnCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const data = await mastersService.createHsnCode(orgId, req.body);
      sendSuccess(res, data, 'HSN/SAC code created successfully', 201);
    } catch (error) {
      next(error);
    }
  },

  async updateHsnCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const data = await mastersService.updateHsnCode(orgId, req.params.id as string, req.body);
      sendSuccess(res, data, 'HSN/SAC code updated successfully');
    } catch (error) {
      next(error);
    }
  },

  async updateHsnRate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const userId = req.user?.userId;
      const data = await mastersService.updateHsnRate(orgId, req.params.id as string, req.body, userId);
      sendSuccess(res, data, 'HSN/SAC rate updated successfully');
    } catch (error) {
      next(error);
    }
  },

  async getHsnRateHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const data = await mastersService.getHsnRateHistory(orgId, req.params.id as string);
      sendSuccess(res, data, 'HSN/SAC rate history retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async deleteHsnCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      await mastersService.deleteHsnCode(orgId, req.params.id as string);
      sendSuccess(res, null, 'HSN/SAC code deleted successfully');
    } catch (error) {
      next(error);
    }
  },

  // ─── Contact Groups ──────────────────────────────────────────────────────────
  async listContactGroups(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const sortBy = req.query.sortBy as string;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc';
      const search = req.query.q as string;
      const withBalances = req.query.withBalances === 'true';

      const result = await mastersService.listContactGroups(orgId, { page, limit, sortBy, sortOrder, search, withBalances });
      sendPaginated(res, result.data, result.pagination.total, result.pagination.page, result.pagination.limit, 'Contact groups retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async getContactGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const data = await mastersService.getContactGroupById(orgId, req.params.id as string);
      sendSuccess(res, data, 'Contact group retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  async createContactGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const data = await mastersService.createContactGroup(orgId, req.body);
      sendSuccess(res, data, 'Contact group created successfully', 201);
    } catch (error) {
      next(error);
    }
  },

  async updateContactGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const data = await mastersService.updateContactGroup(orgId, req.params.id as string, req.body);
      sendSuccess(res, data, 'Contact group updated successfully');
    } catch (error) {
      next(error);
    }
  },

  async deleteContactGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      await mastersService.deleteContactGroup(orgId, req.params.id as string);
      sendSuccess(res, null, 'Contact group deleted successfully');
    } catch (error) {
      next(error);
    }
  },
};
