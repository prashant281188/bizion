import { db } from '../../config/database.js';
import { goodsReceipts, goodsReceiptItems } from '../../db/schema/goods-receipts.js';
import { orders, orderItems } from '../../db/schema/orders.js';
import { inventory, inventoryTransactions, warehouses } from '../../db/schema/inventory.js';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { ApiError } from '../../utils/api-error.js';
import crypto from 'crypto';

// ── Helper: adjust inventory stock ──────────────────────────────────────────
async function adjustStockForGRN(
  tx: any,
  orgId: string,
  warehouseId: string,
  productId: string,
  variantId: string | null,
  quantityChange: number,
  receiptId: string,
  userId: string | null
) {
  const conditions = [
    eq(inventory.orgId, orgId),
    eq(inventory.warehouseId, warehouseId),
    eq(inventory.productId, productId),
    variantId
      ? eq(inventory.variantId, variantId)
      : sql`${inventory.variantId} IS NULL`,
  ];

  let [invRecord] = await tx
    .select()
    .from(inventory)
    .where(and(...conditions))
    .limit(1);

  let newQty: number;
  if (invRecord) {
    newQty = invRecord.quantityOnHand + quantityChange;
    await tx
      .update(inventory)
      .set({ quantityOnHand: newQty, updatedAt: new Date() })
      .where(eq(inventory.id, invRecord.id));
  } else {
    newQty = Math.max(0, quantityChange);
    const [inserted] = await tx.insert(inventory).values({
      orgId,
      warehouseId,
      productId,
      variantId: variantId || null,
      quantityOnHand: newQty,
    }).returning();
    invRecord = inserted;
  }

  // Write audit transaction
  await tx.insert(inventoryTransactions).values({
    orgId,
    inventoryId: invRecord.id,
    type: 'purchase',
    quantityChange,
    quantityAfter: newQty,
    referenceType: 'goods_receipt',
    referenceId: receiptId,
    notes: `Goods received via GRN`,
    createdBy: userId || null,
  });
}

// ── Helper: compute PO fulfillment status ────────────────────────────────────
async function computeOrderStatus(
  tx: any,
  orderId: string
): Promise<'confirmed' | 'partially_received' | 'fully_received'> {
  // Get all order items for this PO
  const poItems = await tx
    .select({ id: orderItems.id, baseQuantity: orderItems.baseQuantity })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  if (poItems.length === 0) return 'confirmed';

  // Get total received per order_item across all GRNs
  const receivedRows = await tx
    .select({
      orderItemId: goodsReceiptItems.orderItemId,
      totalReceived: sql<number>`COALESCE(SUM(${goodsReceiptItems.receivedQty}), 0)`,
    })
    .from(goodsReceiptItems)
    .innerJoin(goodsReceipts, eq(goodsReceiptItems.receiptId, goodsReceipts.id))
    .where(eq(goodsReceipts.orderId, orderId))
    .groupBy(goodsReceiptItems.orderItemId);

  const receivedMap = new Map<string, number>();
  for (const r of receivedRows) {
    if (r.orderItemId) receivedMap.set(r.orderItemId, Number(r.totalReceived));
  }

  let totalOrdered = 0;
  let totalReceived = 0;

  for (const item of poItems) {
    totalOrdered += item.baseQuantity;
    totalReceived += receivedMap.get(item.id) ?? 0;
  }

  if (totalReceived === 0) return 'confirmed';
  if (totalReceived >= totalOrdered) return 'fully_received';
  return 'partially_received';
}

// ── Service ──────────────────────────────────────────────────────────────────
export class GoodsReceiptsService {

  /**
   * Create a Goods Receipt Note for a Purchase Order.
   * Supports partial and multiple-lot deliveries.
   * Updates inventory and recalculates the PO status automatically.
   */
  async createGoodsReceipt(orgId: string, userId: string, data: any) {
    return await db.transaction(async (tx) => {
      // 1. Verify the order is a purchase order and is in a receivable state
      const [order] = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.id, data.orderId), eq(orders.orgId, orgId)))
        .limit(1);

      if (!order) throw new ApiError(404, 'Purchase order not found');
      if (order.type !== 'purchase') throw new ApiError(400, 'GRNs can only be created for purchase orders');
      if (!['confirmed', 'partially_received'].includes(order.status)) {
        throw new ApiError(400, `Cannot receive goods for a PO in '${order.status}' status. Confirm the PO first.`);
      }

      // 2. Verify warehouse exists and belongs to org
      const [warehouse] = await tx
        .select({ id: warehouses.id })
        .from(warehouses)
        .where(and(eq(warehouses.id, data.warehouseId), eq(warehouses.orgId, orgId)))
        .limit(1);

      if (!warehouse) throw new ApiError(404, 'Warehouse not found');

      // 3. Validate items
      if (!data.items || data.items.length === 0) {
        throw new ApiError(400, 'At least one item must be received');
      }

      const hasPositiveQty = data.items.some((i: any) => Number(i.receivedQty) > 0);
      if (!hasPositiveQty) throw new ApiError(400, 'At least one item must have a received quantity > 0');

      // 4. Generate receipt number
      const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
      const receiptNumber = `GRN-${new Date().getFullYear()}-${randomSuffix}`;

      // 5. Insert GRN header
      const [receipt] = await tx.insert(goodsReceipts).values({
        orgId,
        orderId: data.orderId,
        receiptNumber,
        receiptDate: new Date(data.receiptDate || new Date()).toISOString().split('T')[0],
        warehouseId: data.warehouseId,
        status: 'approved',
        notes: data.notes || null,
        createdBy: userId,
      }).returning();

      // 6. Insert GRN items + adjust inventory
      for (const item of data.items) {
        const receivedQty = Number(item.receivedQty) || 0;
        if (receivedQty <= 0) continue; // skip zero-qty items

        await tx.insert(goodsReceiptItems).values({
          orgId,
          receiptId: receipt.id,
          orderItemId: item.orderItemId || null,
          productId: item.productId,
          variantId: item.variantId || null,
          orderedQty: Number(item.orderedQty) || 0,
          receivedQty,
          unitPrice: Number(item.unitPrice || 0).toFixed(2),
        });

        // Adjust inventory (add received qty)
        await adjustStockForGRN(
          tx,
          orgId,
          data.warehouseId,
          item.productId,
          item.variantId || null,
          receivedQty,
          receipt.id,
          userId
        );
      }

      // 7. Update PO status based on total received vs ordered
      const newStatus = await computeOrderStatus(tx, data.orderId);
      await tx
        .update(orders)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(orders.id, data.orderId));

      return { ...receipt, status: newStatus };
    });
  }

  /**
   * List all GRNs for a given Purchase Order.
   */
  async listGoodsReceipts(orgId: string, orderId: string) {
    const receipts = await db.query.goodsReceipts.findMany({
      where: and(eq(goodsReceipts.orgId, orgId), eq(goodsReceipts.orderId, orderId)),
      with: {
        warehouse: { columns: { id: true, name: true, code: true } },
        creator: { columns: { id: true, firstName: true, lastName: true } },
        items: {
          with: {
            product: { columns: { id: true, name: true, sku: true } },
            variant: { columns: { id: true, name: true, sku: true } },
          },
        },
      },
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    });

    return receipts;
  }

  /**
   * Get a single GRN by ID.
   */
  async getGoodsReceipt(orgId: string, receiptId: string) {
    const receipt = await db.query.goodsReceipts.findFirst({
      where: and(eq(goodsReceipts.id, receiptId), eq(goodsReceipts.orgId, orgId)),
      with: {
        order: { columns: { id: true, orderNumber: true, type: true } },
        warehouse: { columns: { id: true, name: true, code: true } },
        creator: { columns: { id: true, firstName: true, lastName: true } },
        items: {
          with: {
            product: { columns: { id: true, name: true, sku: true } },
            variant: { columns: { id: true, name: true, sku: true } },
          },
        },
      },
    });

    if (!receipt) throw new ApiError(404, 'Goods receipt not found');
    return receipt;
  }
}
