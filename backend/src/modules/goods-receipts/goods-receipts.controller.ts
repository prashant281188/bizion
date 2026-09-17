import type { Request, Response, NextFunction } from 'express';
import { GoodsReceiptsService } from './goods-receipts.service.js';
import { sendSuccess } from '../../utils/api-response.js';

const service = new GoodsReceiptsService();

/**
 * POST /goods-receipts
 * Create a Goods Receipt Note for a Purchase Order (partial or full lot).
 */
export async function createGoodsReceipt(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = (req as any).user.orgId;
    const userId = (req as any).user.id;
    const receipt = await service.createGoodsReceipt(orgId, userId, req.body);
    sendSuccess(res, receipt, 'Goods receipt recorded successfully', 201);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /goods-receipts?orderId=xxx
 * List all GRNs for a given Purchase Order.
 */
export async function listGoodsReceipts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = (req as any).user.orgId;
    const orderId = (Array.isArray(req.query.orderId) ? req.query.orderId[0] : String(req.query.orderId || '')) as string;
    if (!orderId) {
      res.status(400).json({ success: false, message: 'orderId query parameter is required' });
      return;
    }
    const receipts = await service.listGoodsReceipts(orgId, orderId);
    sendSuccess(res, receipts, 'Goods receipts fetched');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /goods-receipts/:id
 * Get single GRN details.
 */
export async function getGoodsReceipt(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = (req as any).user.orgId;
    const receipt = await service.getGoodsReceipt(orgId, String(req.params.id));
    sendSuccess(res, receipt, 'Goods receipt fetched');
  } catch (err) {
    next(err);
  }
}
