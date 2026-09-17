import { Request, Response } from 'express';
import { dispatchesService } from './dispatches.service.js';
import { sendSuccess, sendError, sendPaginated } from '../../utils/api-response.js';
import { invoiceService } from '../invoices/invoice.service.js';

export const listDispatches = async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return sendError(res, 'Organization ID missing', 400);

    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

    const result = await dispatchesService.listDispatches(orgId, page, limit);

    sendPaginated(
      res,
      result.data,
      result.pagination.total,
      result.pagination.page,
      result.pagination.limit,
      'Dispatches retrieved successfully'
    );
  } catch (error) {
    console.error('Error listing dispatches:', error);
    sendError(res, 'Failed to list dispatches');
  }
};


export const createDispatch = async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return sendError(res, 'Organization ID missing', 400);

    const { orderIds, contactId, items } = req.body;
    if (!items || !items.length) {
      return sendError(res, 'Items are required', 400);
    }
    
    if ((!orderIds || orderIds.length === 0) && !contactId) {
      return sendError(res, 'Contact ID is required when no orders are selected', 400);
    }

    const userId = req.user?.userId as string;

    const dispatch = await dispatchesService.createManualDispatch(orgId, userId, { orderIds, contactId, items });

    try {
      // Fetch full details to get product info for invoice
      const fullDispatch = await dispatchesService.getDispatchDetails(orgId, dispatch.id);
      
      if (fullDispatch && fullDispatch.items && fullDispatch.items.length > 0) {
        const lineItems = fullDispatch.items.map((item: any) => ({
          productId: item.productId,
          variantId: item.variantId || null,
          description: item.variantName ? item.variantName : item.productName,
          hsnCode: item.hsnCode || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRateId: item.taxRateId || null,
          discountType: 'percentage' as const,
          discountValue: 0,
        }));

        await invoiceService.createInvoice(orgId, userId, {
          documentType: 'sales_invoice',
          invoiceDate: new Date().toISOString().split('T')[0],
          contactId: fullDispatch.contactId || '',
          referenceNumber: fullDispatch.dispatchNumber,
          isInterState: fullDispatch.isInterState,
          status: 'approved',
          supplyType: 'b2b',
          reverseCharge: false,
          currency: 'INR',
          exchangeRate: 1,
          roundOff: 0,
          lineItems,
        });
      }
    } catch (invErr) {
      console.error('Failed to auto-generate invoice:', invErr);
      // Soft failure: we don't fail the dispatch if invoice generation fails
    }

    sendSuccess(res, dispatch, 'Dispatch and Invoice created successfully', 201);
  } catch (error: any) {
    console.error('Error creating dispatch:', error);
    sendError(res, error.message || 'Failed to create dispatch');
  }
};

export const getDispatch = async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return sendError(res, 'Organization ID missing', 400);

    const dispatch = await dispatchesService.getDispatchDetails(orgId, req.params.id as string);
    if (!dispatch) return sendError(res, 'Dispatch not found', 404);

    sendSuccess(res, dispatch, 'Dispatch retrieved');
  } catch (error) {
    console.error('Error getting dispatch:', error);
    sendError(res, 'Failed to get dispatch');
  }
};

export const updateStatus = async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return sendError(res, 'Organization ID missing', 400);

    const { status } = req.body;
    if (!['draft', 'approved', 'shipped', 'delivered', 'cancelled'].includes(status)) {
      return sendError(res, 'Invalid status', 400);
    }

    const updated = await dispatchesService.updateStatus(orgId, req.params.id as string, status);
    if (!updated) return sendError(res, 'Dispatch not found', 404);

    sendSuccess(res, updated, `Dispatch status updated to \${status}`);
  } catch (error) {
    console.error('Error updating dispatch status:', error);
    sendError(res, 'Failed to update dispatch status');
  }
};
