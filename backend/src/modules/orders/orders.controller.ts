import { Request, Response } from 'express';
import { ordersService } from './orders.service.js';
import { sendSuccess, sendError, sendPaginated } from '../../utils/api-response.js';
import { createOrderSchema, updateOrderSchema, updateOrderStatusSchema } from './orders.schema.js';

export const createOrder = async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    const userId = req.user?.userId;
    if (!orgId || !userId) return sendError(res, 'Organization or User ID missing', 400);

    const validatedData = createOrderSchema.parse(req.body);
    const order = await ordersService.createOrder(orgId, userId, validatedData);
    sendSuccess(res, order, 'Order created successfully', 201);
  } catch (error: any) {
    if (error.name === 'ZodError') return sendError(res, 'Validation Error', 400, error.errors);
    console.error('Error creating order:', error);
    sendError(res, 'Failed to create order');
  }
};

export const listOrders = async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return sendError(res, 'Organization ID missing', 400);
    const { type } = req.query;

    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const sortBy = req.query.sortBy as string | undefined;
    const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;
    const contactId = req.query.contactId as string | undefined;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const result = await ordersService.listOrders(orgId, type as string, {
      page,
      limit,
      sortBy,
      sortOrder,
      contactId,
      status,
      search,
      startDate,
      endDate,
    });

    sendPaginated(
      res,
      result.data,
      result.pagination.total,
      result.pagination.page,
      result.pagination.limit,
      'Orders retrieved successfully'
    );
  } catch (error) {
    console.error('Error listing orders:', error);
    sendError(res, 'Failed to list orders');
  }
};

export const getOrder = async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return sendError(res, 'Organization ID missing', 400);
    const order = await ordersService.getOrderDetails(orgId, req.params.id as string);
    if (!order) return sendError(res, 'Order not found', 404);
    sendSuccess(res, order, 'Order retrieved');
  } catch (error) {
    console.error('Error getting order:', error);
    sendError(res, 'Failed to get order');
  }
};

export const updateStatus = async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    const userId = req.user?.userId;
    if (!orgId || !userId) return sendError(res, 'Organization ID missing', 400);
    
    const validatedData = updateOrderStatusSchema.parse(req.body);
    const result = await ordersService.updateOrderStatus(
      orgId, 
      userId, 
      req.params.id as string, 
      validatedData.status, 
      validatedData.warehouseId || undefined,
      validatedData.receivedItems || undefined
    );
    
    sendSuccess(res, result, `Order status updated to ${validatedData.status}`);
  } catch (error: any) {
    if (error.name === 'ZodError') return sendError(res, 'Validation Error', 400, error.errors);
    console.error('Error updating order:', error);
    sendError(res, error.message || 'Failed to update order status', 400);
  }
};

export const getReplenishment = async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.orgId;
    const data = await ordersService.getReplenishmentData(orgId);
    sendSuccess(res, data, 'Replenishment data retrieved');
  } catch (error) {
    console.error('Error getting replenishment:', error);
    sendError(res, 'Failed to calculate replenishment');
  }
};

export const draftReplenishmentPOs = async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.orgId;
    const userId = req.user!.userId;
    const { items } = req.body;
    
    if (!items || !Array.isArray(items)) {
      return sendError(res, 'Items payload is required', 400);
    }
    
    const orders = await ordersService.createReplenishmentDrafts(orgId, userId, items);
    sendSuccess(res, orders, `Successfully drafted ${orders.length} Purchase Order(s)`);
  } catch (error: any) {
    console.error('Error drafting POs:', error);
    sendError(res, error.message || 'Failed to draft purchase orders');
  }
};

export const fulfillOrder = async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    const userId = req.user?.userId;
    if (!orgId || !userId) return sendError(res, 'Organization or User ID missing', 400);

    const result = await ordersService.generateFulfillment(orgId, userId, req.params.id as string);
    sendSuccess(res, result, result.message);
  } catch (error: any) {
    console.error('Error fulfilling order:', error);
    sendError(res, error.message || 'Failed to fulfill order');
  }
};

export const updateOrder = async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    const userId = req.user?.userId;
    if (!orgId || !userId) return sendError(res, 'Organization or User ID missing', 400);

    const validatedData = updateOrderSchema.parse(req.body);
    const order = await ordersService.updateOrder(orgId, userId, req.params.id as string, validatedData);
    sendSuccess(res, order, 'Order updated successfully', 200);
  } catch (error: any) {
    if (error.name === 'ZodError') return sendError(res, 'Validation Error', 400, error.errors);
    if (error.message === 'Order not found or not in draft status') return sendError(res, error.message, 400);
    console.error('Error updating order:', error);
    sendError(res, 'Failed to update order');
  }
};

export const bulkStatus = async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    const userId = req.user?.userId;
    if (!orgId || !userId) return sendError(res, 'Organization or User ID missing', 400);

    const { orderIds, status } = req.body;
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return sendError(res, 'orderIds array is required', 400);
    }
    if (!status) {
      return sendError(res, 'status is required', 400);
    }

    const result = await ordersService.bulkUpdateOrderStatus(orgId, userId, orderIds, status);
    if (result.errors && result.errors.length > 0) {
      if (result.updated === 0) {
        return sendError(res, result.errors[0], 400);
      }
      return sendSuccess(res, result, `Updated ${result.updated} of ${result.total} orders. Some orders failed: ${result.errors[0]}`);
    }
    sendSuccess(res, result, `Successfully updated ${result.updated} of ${result.total} orders to ${status}`);
  } catch (error: any) {
    console.error('Error bulk updating orders:', error);
    sendError(res, error.message || 'Failed to bulk update orders', 400);
  }
};

export const getPendingOrdersReport = async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return sendError(res, 'Organization ID missing', 400);

    const type = (req.query.type as 'sales' | 'purchase') || 'sales';
    const report = await ordersService.getPendingOrdersPartyWise(orgId, type);
    sendSuccess(res, report, 'Pending orders report retrieved successfully');
  } catch (error: any) {
    console.error('Error generating pending orders report:', error);
    sendError(res, error.message || 'Failed to generate pending orders report');
  }
};



