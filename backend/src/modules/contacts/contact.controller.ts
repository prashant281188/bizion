import type { Request, Response, NextFunction } from 'express';
import { contactService } from './contact.service.js';
import { sendSuccess, sendPaginated } from '../../utils/api-response.js';
import { ApiError } from '../../utils/api-error.js';

export const contactController = {
  /**
   * GET /api/v1/contacts
   * Lists customer and vendor contacts.
   */
  async listContacts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const type = req.query.type as string | undefined;
      const status = req.query.status as string | undefined;
      const contactGroupId = req.query.contactGroupId as string | undefined;
      const search = req.query.q as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const sortBy = req.query.sortBy as string | undefined;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;

      const result = await contactService.listContacts(orgId, {
        type,
        status,
        contactGroupId,
        search,
        page,
        limit,
        sortBy,
        sortOrder,
      });

      sendPaginated(res, result.data, result.pagination.total, result.pagination.page, result.pagination.limit, 'Contacts list retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/contacts/:id
   * Retrieves a contact profile with address book.
   */
  async getContact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const contact = await contactService.getContactById(orgId, req.params.id as string);
      sendSuccess(res, contact, 'Contact details retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/contacts/:id/access
   * Check if a contact has portal access.
   */
  async getAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const accessData = await contactService.getContactAccess(orgId, req.params.id as string);
      sendSuccess(res, accessData, 'Contact access details retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/contacts/:id/access
   * Create or update portal access credentials.
   */
  async manageAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const result = await contactService.manageContactAccess(orgId, req.params.id as string, req.body);
      sendSuccess(res, result, 'Contact portal access updated successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/contacts
   * Creates a customer/vendor profile with addresses.
   */
  async createContact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      const userId = req.user?.userId;
      if (!orgId || !userId) throw ApiError.unauthorized('Not authenticated');

      const contact = await contactService.createContact(orgId, userId, req.body);
      sendSuccess(res, contact, 'Contact profile created successfully', 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/contacts/bulk
   * Creates multiple customer/vendor profiles.
   */
  async createBulkContacts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      const userId = req.user?.userId;
      if (!orgId || !userId) throw ApiError.unauthorized('Not authenticated');

      const contacts = await contactService.createBulkContacts(orgId, userId, req.body.contacts);
      sendSuccess(res, { count: contacts.length }, `${contacts.length} contacts imported successfully`, 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/v1/contacts/:id
   * Updates contact details.
   */
  async updateContact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const contact = await contactService.updateContact(orgId, req.params.id as string, req.body);
      sendSuccess(res, contact, 'Contact details updated successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/contacts/:id/status
   * Toggle or set contact active status.
   */
  async toggleStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const { isActive } = req.body || {};
      const updated = await contactService.toggleStatus(orgId, req.params.id as string, isActive);
      sendSuccess(res, updated, `Contact ${updated.isActive ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/contacts/:id
   * Deactivates a customer/vendor profile (or soft-deletes if query param hard=true).
   */
  async deleteContact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const isHard = req.query.hard === 'true';
      if (isHard) {
        await contactService.deleteContact(orgId, req.params.id as string);
        sendSuccess(res, null, 'Contact profile deleted permanently');
      } else {
        const updated = await contactService.toggleStatus(orgId, req.params.id as string, false);
        sendSuccess(res, updated, 'Contact deactivated successfully');
      }
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/contacts/:id/analytics
   * Gets comprehensive customer analytics.
   */
  async getAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const analytics = await contactService.getContactAnalytics(orgId, req.params.id as string);
      sendSuccess(res, analytics, 'Customer analytics fetched successfully');
    } catch (error) {
      next(error);
    }
  },

  // ─── Addresses Sub-routes ──────────────────────────────────────────────────

  /**
   * POST /api/v1/contacts/:id/addresses
   * Adds an address.
   */
  async addAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      const contactId = req.params.id as string;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const address = await contactService.addAddress(orgId, contactId, req.body);
      sendSuccess(res, address, 'Address added successfully', 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/v1/contacts/:id/addresses/:addressId
   * Updates an address.
   */
  async updateAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      const contactId = req.params.id as string;
      const addressId = req.params.addressId as string;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const address = await contactService.updateAddress(orgId, contactId, addressId, req.body);
      sendSuccess(res, address, 'Address updated successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/contacts/:id/addresses/:addressId
   * Soft-deletes an address.
   */
  async deleteAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      const contactId = req.params.id as string;
      const addressId = req.params.addressId as string;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      await contactService.deleteAddress(orgId, contactId, addressId);
      sendSuccess(res, null, 'Address deleted successfully');
    } catch (error) {
      next(error);
    }
  },

  // ─── Custom Pricing Sub-routes ─────────────────────────────────────────────

  async listCustomPrices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      const contactId = req.params.id as string;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const sortBy = req.query.sortBy as string | undefined;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;

      const result = await contactService.listCustomPrices(orgId, contactId, {
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
        'Custom prices retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  },

  async setCustomPrice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      const contactId = req.params.id as string;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      const customPrice = await contactService.setCustomPrice(orgId, contactId, req.body);
      sendSuccess(res, customPrice, 'Custom price rule set successfully', 200);
    } catch (error) {
      next(error);
    }
  },

  async deleteCustomPrice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      const contactId = req.params.id as string;
      const priceId = req.params.priceId as string;
      if (!orgId) throw ApiError.unauthorized('Not authenticated');

      await contactService.deleteCustomPrice(orgId, contactId, priceId);
      sendSuccess(res, null, 'Custom price rule deleted successfully');
    } catch (error) {
      next(error);
    }
  },
};
