import { eq, and, desc, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { dispatches, dispatchItems } from '../../db/schema/dispatches.js';
import { orders, orderItems } from '../../db/schema/orders.js';
import { products, productVariants } from '../../db/schema/products.js';
import { contacts, hsnCodes } from '../../db/schema/index.js';
import { sql } from 'drizzle-orm';
import { invoices } from '../../db/schema/invoices.js';

export class DispatchesService {
  async listDispatches(orgId: string, page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    const data = await db
      .select({
        id: dispatches.id,
        dispatchNumber: dispatches.dispatchNumber,
        status: dispatches.status,
        orderId: dispatches.orderId,
        orderNumber: sql<string>`COALESCE(${orders.orderNumber}, (
          SELECT string_agg(DISTINCT o.order_number, ', ')
          FROM ${dispatchItems} di
          JOIN ${orderItems} oi ON oi.id = di.order_item_id
          JOIN ${orders} o ON o.id = oi.order_id
          WHERE di.dispatch_id = ${dispatches.id}
        ))`,
        createdAt: dispatches.createdAt,
      })
      .from(dispatches)
      .leftJoin(orders, eq(dispatches.orderId, orders.id))
      .where(eq(dispatches.orgId, orgId))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(dispatches.createdAt));

    // For total count
    const all = await db.select({ id: dispatches.id }).from(dispatches).where(eq(dispatches.orgId, orgId));
    const total = all.length;

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getDispatchDetails(orgId: string, dispatchId: string) {
    const [dispatch] = await db.select({
      dispatch: dispatches,
      contactName: contacts.displayName,
      contactPhone: contacts.phone,
      contactEmail: contacts.email,
      isInterState: orders.isInterState
    })
    .from(dispatches)
    .leftJoin(contacts, eq(dispatches.contactId, contacts.id))
    .leftJoin(orders, eq(dispatches.orderId, orders.id))
    .where(and(eq(dispatches.id, dispatchId), eq(dispatches.orgId, orgId)));

    if (!dispatch) return null;

    // Fetch items with order and product details
    const dItems = await db.select({
      id: dispatchItems.id,
      quantity: dispatchItems.quantity,
      orderItemId: dispatchItems.orderItemId,
      orderNumber: orders.orderNumber,
      orderDate: orders.orderDate,
      productId: sql<string>`COALESCE(${dispatchItems.productId}, ${orderItems.productId})`,
      variantId: sql<string>`COALESCE(${dispatchItems.variantId}, ${orderItems.variantId})`,
      productName: products.name,
      variantName: productVariants.name,
      sku: products.sku,
      unitPrice: sql<number>`COALESCE(${dispatchItems.unitPrice}, ${orderItems.unitPrice})`,
      taxRateId: sql<string>`COALESCE(${orderItems.taxRateId}, ${products.taxRateId})`,
      hsnCode: hsnCodes.code,
    })
    .from(dispatchItems)
    .leftJoin(orderItems, eq(dispatchItems.orderItemId, orderItems.id))
    .leftJoin(orders, eq(orderItems.orderId, orders.id))
    .leftJoin(products, sql`${products.id} = COALESCE(${dispatchItems.productId}, ${orderItems.productId})`)
    .leftJoin(productVariants, sql`${productVariants.id} = COALESCE(${dispatchItems.variantId}, ${orderItems.variantId})`)
    .leftJoin(hsnCodes, eq(products.hsnCodeId, hsnCodes.id))
    .where(eq(dispatchItems.dispatchId, dispatchId));

    // Fetch primary order details if orderId is set on dispatch
    let primaryOrderNumber: string | null = null;
    if (dispatch.dispatch.orderId) {
      const [pOrder] = await db.select({ orderNumber: orders.orderNumber })
        .from(orders)
        .where(eq(orders.id, dispatch.dispatch.orderId));
      primaryOrderNumber = pOrder?.orderNumber || null;
    }

    const itemsWithOrder = dItems.map(item => ({
      ...item,
      orderNumber: item.orderNumber || primaryOrderNumber || null,
    }));

    // Fetch linked invoice if any
    const [linkedInvoice] = await db.select({ id: invoices.id })
      .from(invoices)
      .where(and(
        eq(invoices.orgId, orgId),
        eq(invoices.referenceNumber, dispatch.dispatch.dispatchNumber),
        eq(invoices.documentType, 'sales_invoice')
      ))
      .limit(1);

    const relatedOrderNumbers = [...new Set(itemsWithOrder.map(i => i.orderNumber).filter(Boolean))];

    return {
      ...dispatch.dispatch,
      contactName: dispatch.contactName || 'N/A',
      contactPhone: dispatch.contactPhone || 'N/A',
      contactEmail: dispatch.contactEmail || 'N/A',
      isInterState: dispatch.isInterState || false,
      items: itemsWithOrder,
      invoiceId: linkedInvoice?.id || null,
      orderNumber: primaryOrderNumber || relatedOrderNumbers[0] || null,
      orderNumbers: relatedOrderNumbers.join(', ') || primaryOrderNumber || 'Standalone Dispatch'
    };
  }

  async createDispatch(orgId: string, orderId: string, items: { orderItemId: string; quantity: number }[]) {
    return await db.transaction(async (tx) => {
      // Create dispatch record
      const dispatchNumber = `DSP-${Date.now().toString().slice(-6)}`;
      const [dispatch] = await tx.insert(dispatches).values({
        orgId,
        orderId,
        dispatchNumber,
        status: 'draft',
      }).returning();

      // Create items
      for (const item of items) {
        await tx.insert(dispatchItems).values({
          dispatchId: dispatch.id,
          orderItemId: item.orderItemId,
          quantity: item.quantity,
        });
      }

      return dispatch;
    });
  }

  
  async createManualDispatch(orgId: string, userId: string, payload: { orderIds: string[], contactId?: string, items: any[] }) {
    const { orderIds, contactId, items } = payload;
    return await db.transaction(async (tx) => {
      const isStandalone = !orderIds || orderIds.length === 0;
      
      let primaryOrder = null;
      let primaryOrderId: string | null = null;
      let actualContactId = contactId || null;

      if (!isStandalone) {
        const ordersList = await tx.select().from(orders).where(and(inArray(orders.id, orderIds), eq(orders.orgId, orgId)));
        if (ordersList.length !== orderIds.length) throw new Error('One or more orders not found');
        
        primaryOrderId = orderIds[0];
        primaryOrder = ordersList.find(o => o.id === primaryOrderId)!;
        if (!actualContactId) {
          actualContactId = primaryOrder.contactId;
        }
      }
      

      // Check if new items are added, insert them into orderItems first if linked to an order
      let updatedTotalAmount = primaryOrder ? Number(primaryOrder.totalAmount) : 0;
      
      for (const item of items) {
        if (item.isNew && item.productId) {
          // Calculate base quantity and price
          let boxQty = 1;
          if (item.variantId) {
            const [v] = await tx.select().from(productVariants).where(eq(productVariants.id, item.variantId));
            if (v) boxQty = v.boxQuantity;
          } else {
            const [p] = await tx.select().from(products).where(eq(products.id, item.productId));
            if (p) boxQty = p.boxQuantity;
          }
          
          const baseQuantity = item.unitType === 'box' ? item.quantity * boxQty : item.quantity;
          const totalPrice = item.quantity * Number(item.unitPrice || 0);
          
          if (!isStandalone && primaryOrderId) {
            updatedTotalAmount += totalPrice;
            
            const [newOrderItem] = await tx.insert(orderItems).values({
              orgId,
              orderId: primaryOrderId,
              productId: item.productId,
              variantId: item.variantId || null,
              unitType: item.unitType || 'loose',
              orderQuantity: item.quantity,
              baseQuantity,
              unitPrice: Number(item.unitPrice || 0).toFixed(2),
              totalPrice: totalPrice.toFixed(2),
            }).returning();
            
            item.orderItemId = newOrderItem.id;
          }
        }
      }

      if (!isStandalone && primaryOrder && updatedTotalAmount !== Number(primaryOrder.totalAmount)) {
        await tx.update(orders)
          .set({ totalAmount: updatedTotalAmount.toFixed(2), updatedAt: new Date() })
          .where(eq(orders.id, primaryOrderId!));
      }

      // Create dispatch record
      const dispatchNumber = `DSP-${Date.now().toString().slice(-6)}`;
      const [dispatch] = await tx.insert(dispatches).values({
        orgId,
        orderId: primaryOrderId,
        contactId: actualContactId,
        dispatchNumber,
        status: 'shipped', // directly mark as shipped or draft depending on business logic. User says "after creating dispatch sale order status will be updated"
      }).returning();

      // Create dispatch items
      for (const item of items) {
        if (!isStandalone && !item.orderItemId) throw new Error('Missing orderItemId for dispatch item');
        
        await tx.insert(dispatchItems).values({
          dispatchId: dispatch.id,
          orderItemId: item.orderItemId || null,
          productId: item.productId || null,
          variantId: item.variantId || null,
          unitType: item.unitType || 'loose',
          unitPrice: item.unitPrice ? item.unitPrice.toString() : null,
          quantity: item.dispatchQuantity || item.quantity,
        });
      }

      // Calculate total dispatch quantities for the orders to update order status
      for (const currentOrderId of orderIds) {
        const allOrderItems = await tx.select().from(orderItems).where(eq(orderItems.orderId, currentOrderId));
        
        let allFullyDispatched = true;
        let anyDispatched = false;
        for (const oi of allOrderItems) {
          const [dispatchSum] = await tx.select({
            total: sql<number>`sum(${dispatchItems.quantity})`.mapWith(Number)
          }).from(dispatchItems)
          .where(eq(dispatchItems.orderItemId, oi.id));
          
          const dispatchedQty = dispatchSum?.total || 0;
          if (dispatchedQty > 0) {
            anyDispatched = true;
          }
          if (dispatchedQty < oi.baseQuantity) {
            allFullyDispatched = false;
          }
        }

        const newOrderStatus = allFullyDispatched ? 'delivered' : (anyDispatched ? 'partially_dispatched' : 'confirmed');
        await tx.update(orders)
          .set({ status: newOrderStatus, updatedAt: new Date() })
          .where(eq(orders.id, currentOrderId));
      }
      
      

      return dispatch;
    });
  }

  async updateStatus(orgId: string, dispatchId: string, status: 'draft' | 'approved' | 'shipped' | 'delivered' | 'cancelled') {
    const [updated] = await db.update(dispatches)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(dispatches.id, dispatchId), eq(dispatches.orgId, orgId)))
      .returning();
    return updated;
  }
}

export const dispatchesService = new DispatchesService();
