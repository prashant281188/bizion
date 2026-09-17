import { Request, Response } from 'express';
import { inventoryService } from './inventory.service.js';
import { sendSuccess, sendError, sendPaginated } from '../../utils/api-response.js';
import { createWarehouseSchema, adjustStockSchema } from './inventory.schema.js';

export const listWarehouses = async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return sendError(res, 'Organization ID is missing', 400);

    const warehouses = await inventoryService.listWarehouses(orgId);
    sendSuccess(res, warehouses, 'Warehouses retrieved successfully');
  } catch (error) {
    console.error('Error listing warehouses:', error);
    sendError(res, 'Failed to retrieve warehouses');
  }
};

export const createWarehouse = async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return sendError(res, 'Organization ID is missing', 400);

    const validatedData = createWarehouseSchema.parse(req.body);
    const warehouse = await inventoryService.createWarehouse(orgId, validatedData);
    sendSuccess(res, warehouse, 'Warehouse created successfully', 201);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return sendError(res, 'Validation Error', 400, error.errors);
    }
    console.error('Error creating warehouse:', error);
    sendError(res, 'Failed to create warehouse');
  }
};

export const listStock = async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return sendError(res, 'Organization ID is missing', 400);

    const { warehouseId, search } = req.query;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const sortBy = req.query.sortBy as string | undefined;
    const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;
    
    const result = await inventoryService.listStock(orgId, {
      warehouseId: warehouseId as string,
      search: search as string,
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
      'Stock levels retrieved successfully'
    );
  } catch (error) {
    console.error('Error listing stock:', error);
    sendError(res, 'Failed to retrieve stock levels');
  }
};

export const adjustStock = async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    const userId = req.user?.userId;
    if (!orgId || !userId) return sendError(res, 'Organization or User ID missing', 400);

    const validatedData = adjustStockSchema.parse(req.body);
    
    const result = await inventoryService.adjustStock(orgId, userId, validatedData);
    sendSuccess(res, result, 'Stock adjusted successfully');
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return sendError(res, 'Validation Error', 400, error.errors);
    }
    console.error('Error adjusting stock:', error);
    sendError(res, 'Failed to adjust stock');
  }
};

export const listTransactions = async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return sendError(res, 'Organization ID is missing', 400);

    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const sortBy = req.query.sortBy as string | undefined;
    const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;

    const result = await inventoryService.listTransactions(orgId, {
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
      'Transactions retrieved successfully'
    );
  } catch (error) {
    console.error('Error listing transactions:', error);
    sendError(res, 'Failed to retrieve transactions');
  }
};
