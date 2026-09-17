import { db } from '../../config/database.js';
import { orders, orderItems } from '../../db/schema/orders.js';
import { products, productVariants, productVariantPriceHistory, productPricingRules } from '../../db/schema/products.js';
import { inventory, inventoryTransactions } from '../../db/schema/inventory.js';
import { contacts } from '../../db/schema/contacts.js';
import { taxRates } from '../../db/schema/masters.js';
import { dispatches, dispatchItems } from '../../db/schema/dispatches.js';
import { goodsReceipts, goodsReceiptItems } from '../../db/schema/goods-receipts.js';
import { contactCustomPrices } from '../../db/schema/contact-prices.js';
import { eq, and, or, desc, asc, sql, inArray, ilike, isNull, gte, lte } from 'drizzle-orm';
import crypto from 'crypto';

export class OrdersService {
  /**
   * Create a new sales or purchase order
   */
  async createOrder(orgId: string, userId: string, data: any) {
    return await db.transaction(async (tx) => {
      // Generate Order Number
      const prefix = data.type === 'sales' ? 'SO-' : 'PO-';
      const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
      const orderNumber = `${prefix}${new Date().getFullYear()}-${randomSuffix}`;

      if (data.contactId) {
        const [contact] = await tx
          .select()
          .from(contacts)
          .where(and(eq(contacts.orgId, orgId), eq(contacts.id, data.contactId)))
          .limit(1);
        
        if (!contact) throw new Error('Recipient contact not found');

        if (data.type === 'sales' && contact.type === 'vendor') {
          throw new Error('Cannot create a sales order for a vendor contact');
        }
        if (data.type === 'purchase' && contact.type === 'customer') {
          throw new Error('Cannot create a purchase order for a customer contact');
        }
      }

      let totalAmount = 0;
      let taxableAmount = 0;
      let totalCgstAmount = 0;
      let totalSgstAmount = 0;
      let totalIgstAmount = 0;
      let totalTaxAmount = 0;

      const isInterState = data.isInterState === true;

      const customPricesToUpsert: any[] = [];
      const purchasePricesToUpdate: any[] = [];

      // Prepare order items
      const itemsToInsert = [];
      for (const item of data.items) {
        // Fetch box quantity
        let boxQty = 1;
        let taxRateId = null;
        let globalSellingPrice = 0;
        let globalCostPrice = 0;
        let pOrV: any = null;
        let isVar = false;

        if (item.variantId) {
          const v = await tx.query.productVariants.findFirst({ where: eq(productVariants.id, item.variantId), with: { product: true } });
          const rule = await tx.query.productPricingRules.findFirst({ where: and(eq(productPricingRules.productId, item.productId), eq(productPricingRules.variantId, item.variantId), isNull(productPricingRules.priceListId)) });
          if (v) {
             boxQty = v.boxQuantity;
             taxRateId = v.product.taxRateId;
             globalSellingPrice = rule ? Number(rule.listPrice) : 0;
             globalCostPrice = Number(v.valuationCost);
             pOrV = v;
             isVar = true;
          }
        } else {
          const p = await tx.query.products.findFirst({ where: eq(products.id, item.productId) });
          const rule = await tx.query.productPricingRules.findFirst({ where: and(eq(productPricingRules.productId, item.productId), isNull(productPricingRules.variantId), isNull(productPricingRules.priceListId)) });
          if (p) {
             boxQty = p.boxQuantity;
             taxRateId = p.taxRateId;
             globalSellingPrice = rule ? Number(rule.listPrice) : 0;
             globalCostPrice = Number(p.valuationCost);
             pOrV = p;
             isVar = false;
          }
        }

        if (data.type === 'sales' && globalSellingPrice > 0 && Number(item.unitPrice) !== globalSellingPrice && item.productId) {
          customPricesToUpsert.push({
            orgId,
            contactId: data.contactId,
            productId: item.productId,
            variantId: item.variantId || null,
            customPrice: Number(item.unitPrice).toFixed(2),
          });
        }

        if (data.type === 'purchase' && Number(item.unitPrice) !== globalCostPrice && pOrV) {
          purchasePricesToUpdate.push({
            productOrVariant: pOrV,
            isVariant: isVar,
            newCostPrice: Number(item.unitPrice).toFixed(2),
          });
        }

        const baseQuantity = item.unitType === 'box' ? item.orderQuantity * boxQty : item.orderQuantity;
        const itemTaxableValue = item.orderQuantity * Number(item.unitPrice);

        let taxRatePercent = 0;
        let cgstRate = 0;
        let sgstRate = 0;
        let igstRate = 0;

        if (taxRateId) {
          const rate = await tx.query.taxRates.findFirst({ where: eq(taxRates.id, taxRateId) });
          if (rate) {
            taxRatePercent = Number(rate.ratePercentage);
            if (isInterState) {
              igstRate = Number(rate.igstRate);
            } else {
              cgstRate = Number(rate.cgstRate);
              sgstRate = Number(rate.sgstRate);
            }
          }
        }

        const itemCgstAmount = (itemTaxableValue * cgstRate) / 100;
        const itemSgstAmount = (itemTaxableValue * sgstRate) / 100;
        const itemIgstAmount = (itemTaxableValue * igstRate) / 100;
        const itemTotalTax = itemCgstAmount + itemSgstAmount + itemIgstAmount;
        const itemTotalAmount = itemTaxableValue + itemTotalTax;

        taxableAmount += itemTaxableValue;
        totalCgstAmount += itemCgstAmount;
        totalSgstAmount += itemSgstAmount;
        totalIgstAmount += itemIgstAmount;
        totalTaxAmount += itemTotalTax;
        totalAmount += itemTotalAmount;

        itemsToInsert.push({
          orgId,
          productId: item.productId,
          variantId: item.variantId || null,
          unitType: item.unitType,
          orderQuantity: item.orderQuantity,
          baseQuantity,
          unitPrice: Number(item.unitPrice).toFixed(2),
          taxableValue: itemTaxableValue.toFixed(2),
          taxRateId,
          taxRatePercent: taxRatePercent.toFixed(2),
          cgstAmount: itemCgstAmount.toFixed(2),
          sgstAmount: itemSgstAmount.toFixed(2),
          igstAmount: itemIgstAmount.toFixed(2),
          totalPrice: itemTotalAmount.toFixed(2),
        });
      }

      const roundOff = data.roundOff !== undefined ? Number(data.roundOff) : (Math.round(totalAmount) - totalAmount);
      const finalTotalAmount = taxableAmount + totalTaxAmount + roundOff;

      const [order] = await tx.insert(orders).values({
        orgId,
        orderNumber,
        type: data.type,
        status: 'draft',
        contactId: data.contactId || null,
        orderDate: new Date(data.orderDate).toISOString().split('T')[0],
        expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate).toISOString().split('T')[0] : null,
        isInterState,
        taxableAmount: taxableAmount.toFixed(2),
        cgstAmount: totalCgstAmount.toFixed(2),
        sgstAmount: totalSgstAmount.toFixed(2),
        igstAmount: totalIgstAmount.toFixed(2),
        totalTaxAmount: totalTaxAmount.toFixed(2),
        roundOff: roundOff.toFixed(2),
        totalAmount: finalTotalAmount.toFixed(2),
        notes: data.notes,
        createdBy: userId,
      }).returning();

      for (const item of itemsToInsert) {
        await tx.insert(orderItems).values({
          ...item,
          orderId: order.id,
        });
      }

      // If it's a sales order, we should theoretically reserve stock here,
      // but for simplicity, we'll wait until 'confirmed' status.

      // Upsert custom party prices
      if (customPricesToUpsert.length > 0) {
        for (const cp of customPricesToUpsert) {
          const conditions = [
            eq(contactCustomPrices.orgId, cp.orgId),
            eq(contactCustomPrices.contactId, cp.contactId),
            eq(contactCustomPrices.productId, cp.productId),
          ];
          if (cp.variantId) {
            conditions.push(eq(contactCustomPrices.variantId, cp.variantId));
          } else {
            conditions.push(sql`${contactCustomPrices.variantId} IS NULL`);
          }

          const [existingCp] = await tx
            .select()
            .from(contactCustomPrices)
            .where(and(...conditions))
            .limit(1);

          if (existingCp) {
            await tx
              .update(contactCustomPrices)
              .set({ customPrice: cp.customPrice, updatedAt: new Date() })
              .where(eq(contactCustomPrices.id, existingCp.id));
          } else {
            await tx.insert(contactCustomPrices).values(cp);
          }
        }
      }

      // Update Global Purchase Rates & History
      if (purchasePricesToUpdate.length > 0) {
        for (const update of purchasePricesToUpdate) {
          const { productOrVariant, isVariant, newCostPrice } = update;
          if (isVariant) {
            await tx
              .update(productVariants)
              .set({  updatedAt: new Date() })
              .where(eq(productVariants.id, productOrVariant.id));
          } else {
            await tx
              .update(products)
              .set({  updatedAt: new Date() })
              .where(eq(products.id, productOrVariant.id));
          }

          await tx.insert(productVariantPriceHistory).values({
            orgId,
            productId: isVariant ? productOrVariant.productId : productOrVariant.id,
            variantId: isVariant ? productOrVariant.id : null,
            
            
            
            mrp: productOrVariant.mrp,
            
            
            
            valuationCost: '0',
            
            
            
            createdBy: userId,
          });
        }
      }

      return order;
    });
  }

  async listOrders(
    orgId: string,
    type?: string,
    filters: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      contactId?: string;
      status?: string | string[];
      search?: string;
      startDate?: string;
      endDate?: string;
    } = {}
  ) {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const offset = (page - 1) * limit;

    const conditions = [eq(orders.orgId, orgId)];
    if (type) {
      conditions.push(eq(orders.type, type));
    }
    if (filters.contactId) {
      conditions.push(eq(orders.contactId, filters.contactId));
    }
    if (filters.startDate) {
      conditions.push(sql`DATE(${orders.orderDate}) >= ${filters.startDate}::date`);
    }
    if (filters.endDate) {
      conditions.push(sql`DATE(${orders.orderDate}) <= ${filters.endDate}::date`);
    }
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(inArray(orders.status, filters.status));
      } else {
        const statuses = filters.status.split(',');
        if (statuses.length > 1) {
          conditions.push(inArray(orders.status, statuses));
        } else {
          conditions.push(eq(orders.status, filters.status));
        }
      }
    }
    if (filters.search) {
      conditions.push(
        or(
          ilike(contacts.displayName, `%${filters.search}%`),
          ilike(orders.orderNumber, `%${filters.search}%`)
        )!
      );
    }
    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .leftJoin(contacts, eq(orders.contactId, contacts.id))
      .where(whereClause);

    const total = countResult?.count || 0;
    const totalPages = Math.ceil(total / limit);

    const data = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        type: orders.type,
        status: orders.status,
        orderDate: orders.orderDate,
        totalAmount: orders.totalAmount,
        contactName: contacts.displayName,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .leftJoin(contacts, eq(orders.contactId, contacts.id))
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(
        ...(() => {
          const sortFields: any[] = [];
          
          // Always prioritize: draft -> confirmed -> partial dispatch -> delivered
          const statusPrioritySql = sql`CASE ${orders.status}
            WHEN 'draft' THEN 1
            WHEN 'confirmed' THEN 2
            WHEN 'partially_dispatched' THEN 3
            WHEN 'processing' THEN 4
            WHEN 'shipped' THEN 5
            WHEN 'delivered' THEN 6
            WHEN 'cancelled' THEN 7
            ELSE 8
          END`;

          sortFields.push(asc(statusPrioritySql));

          const orderFn = filters.sortOrder === 'asc' ? asc : desc;
          if (filters.sortBy === 'orderNumber') sortFields.push(orderFn(orders.orderNumber));
          else if (filters.sortBy === 'orderDate') sortFields.push(orderFn(orders.orderDate));
          else if (filters.sortBy === 'totalAmount') sortFields.push(orderFn(orders.totalAmount));
          else if (filters.sortBy === 'contactName') sortFields.push(orderFn(contacts.displayName));
          else sortFields.push(orderFn(orders.createdAt));
          
          return sortFields;
        })()
      );

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }


  async updateOrder(orgId: string, userId: string, orderId: string, data: any) {
    return await db.transaction(async (tx) => {
      // Check if order exists and is in draft status
      const existingOrder = await tx.query.orders.findFirst({
        where: and(eq(orders.id, orderId), eq(orders.orgId, orgId))
      });

      if (!existingOrder) throw new Error('Order not found');
      if (!['draft', 'confirmed'].includes(existingOrder.status)) {
        throw new Error('Only draft and confirmed orders can be edited');
      }

      if (data.contactId && data.contactId !== existingOrder.contactId) {
        const [contact] = await tx
          .select()
          .from(contacts)
          .where(and(eq(contacts.orgId, orgId), eq(contacts.id, data.contactId)))
          .limit(1);
        
        if (!contact) throw new Error('Recipient contact not found');

        if (existingOrder.type === 'sales' && contact.type === 'vendor') {
          throw new Error('Cannot use a vendor contact for a sales order');
        }
        if (existingOrder.type === 'purchase' && contact.type === 'customer') {
          throw new Error('Cannot use a customer contact for a purchase order');
        }
      }

      let totalAmount = 0;
      let taxableAmount = 0;
      let totalCgstAmount = 0;
      let totalSgstAmount = 0;
      let totalIgstAmount = 0;
      let totalTaxAmount = 0;

      const isInterState = data.isInterState === true;

      const customPricesToUpsert: any[] = [];
      const purchasePricesToUpdate: any[] = [];
      const itemsToInsert = [];

      for (const item of data.items) {
        let boxQty = 1;
        let taxRateId = null;
        let globalSellingPrice = 0;
        let globalCostPrice = 0;
        let pOrV: any = null;
        let isVar = false;

        if (item.variantId) {
          const v = await tx.query.productVariants.findFirst({ where: eq(productVariants.id, item.variantId), with: { product: true } });
          const rule = await tx.query.productPricingRules.findFirst({ where: and(eq(productPricingRules.productId, item.productId), eq(productPricingRules.variantId, item.variantId), isNull(productPricingRules.priceListId)) });
          if (v) {
            boxQty = v.boxQuantity;
            taxRateId = v.product.taxRateId;
            globalSellingPrice = rule ? Number(rule.listPrice) : 0;
            globalCostPrice = Number(v.valuationCost);
            pOrV = v;
            isVar = true;
          }
        } else {
          const p = await tx.query.products.findFirst({ where: eq(products.id, item.productId) });
          const rule = await tx.query.productPricingRules.findFirst({ where: and(eq(productPricingRules.productId, item.productId), isNull(productPricingRules.variantId), isNull(productPricingRules.priceListId)) });
          if (p) {
            boxQty = p.boxQuantity;
            taxRateId = p.taxRateId;
            globalSellingPrice = rule ? Number(rule.listPrice) : 0;
            globalCostPrice = Number(p.valuationCost);
            pOrV = p;
            isVar = false;
          }
        }

        if (existingOrder.type === 'sales' && globalSellingPrice > 0 && Number(item.unitPrice) !== globalSellingPrice && item.productId) {
          customPricesToUpsert.push({
            orgId,
            contactId: data.contactId || existingOrder.contactId,
            productId: item.productId,
            variantId: item.variantId || null,
            customPrice: Number(item.unitPrice).toFixed(2),
          });
        }

        if (existingOrder.type === 'purchase' && Number(item.unitPrice) !== globalCostPrice && pOrV) {
          purchasePricesToUpdate.push({
            productOrVariant: pOrV,
            isVariant: isVar,
            newCostPrice: Number(item.unitPrice).toFixed(2),
          });
        }

        const baseQuantity = item.unitType === 'box' ? item.orderQuantity * boxQty : item.orderQuantity;
        const itemTaxableValue = item.orderQuantity * Number(item.unitPrice);
        
        let taxRatePercent = 0;
        let cgstRate = 0;
        let sgstRate = 0;
        let igstRate = 0;

        if (taxRateId) {
          const rate = await tx.query.taxRates.findFirst({ where: eq(taxRates.id, taxRateId) });
          if (rate) {
            taxRatePercent = Number(rate.ratePercentage);
            if (isInterState) {
              igstRate = Number(rate.igstRate);
            } else {
              cgstRate = Number(rate.cgstRate);
              sgstRate = Number(rate.sgstRate);
            }
          }
        }

        const itemCgstAmount = (itemTaxableValue * cgstRate) / 100;
        const itemSgstAmount = (itemTaxableValue * sgstRate) / 100;
        const itemIgstAmount = (itemTaxableValue * igstRate) / 100;
        const itemTotalTax = itemCgstAmount + itemSgstAmount + itemIgstAmount;
        const itemTotalAmount = itemTaxableValue + itemTotalTax;

        taxableAmount += itemTaxableValue;
        totalCgstAmount += itemCgstAmount;
        totalSgstAmount += itemSgstAmount;
        totalIgstAmount += itemIgstAmount;
        totalTaxAmount += itemTotalTax;
        totalAmount += itemTotalAmount;

        itemsToInsert.push({
          orgId,
          orderId,
          productId: item.productId,
          variantId: item.variantId || null,
          unitType: item.unitType,
          orderQuantity: item.orderQuantity,
          baseQuantity,
          unitPrice: Number(item.unitPrice).toFixed(2),
          taxableValue: itemTaxableValue.toFixed(2),
          taxRateId,
          taxRatePercent: taxRatePercent.toFixed(2),
          cgstAmount: itemCgstAmount.toFixed(2),
          sgstAmount: itemSgstAmount.toFixed(2),
          igstAmount: itemIgstAmount.toFixed(2),
          totalPrice: itemTotalAmount.toFixed(2),
        });
      }

      const roundOff = data.roundOff !== undefined ? Number(data.roundOff) : (Math.round(totalAmount) - totalAmount);
      const finalTotalAmount = taxableAmount + totalTaxAmount + roundOff;

      await tx.update(orders).set({
        contactId: data.contactId || null,
        orderDate: new Date(data.orderDate).toISOString().split('T')[0],
        expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate).toISOString().split('T')[0] : null,
        isInterState,
        taxableAmount: taxableAmount.toFixed(2),
        cgstAmount: totalCgstAmount.toFixed(2),
        sgstAmount: totalSgstAmount.toFixed(2),
        igstAmount: totalIgstAmount.toFixed(2),
        totalTaxAmount: totalTaxAmount.toFixed(2),
        roundOff: roundOff.toFixed(2),
        totalAmount: finalTotalAmount.toFixed(2),
        notes: data.notes,
        updatedAt: new Date()
      }).where(eq(orders.id, orderId));

      // Delete existing items
      await tx.delete(orderItems).where(eq(orderItems.orderId, orderId));

      // Insert new items
      for (const item of itemsToInsert) {
        await tx.insert(orderItems).values(item);
      }

      // Upsert custom party prices
      if (customPricesToUpsert.length > 0) {
        for (const cp of customPricesToUpsert) {
          const conditions = [
            eq(contactCustomPrices.orgId, cp.orgId),
            eq(contactCustomPrices.contactId, cp.contactId),
            eq(contactCustomPrices.productId, cp.productId),
          ];
          if (cp.variantId) {
            conditions.push(eq(contactCustomPrices.variantId, cp.variantId));
          } else {
            conditions.push(sql`${contactCustomPrices.variantId} IS NULL`);
          }

          const [existingCp] = await tx
            .select()
            .from(contactCustomPrices)
            .where(and(...conditions))
            .limit(1);

          if (existingCp) {
            await tx
              .update(contactCustomPrices)
              .set({ customPrice: cp.customPrice, updatedAt: new Date() })
              .where(eq(contactCustomPrices.id, existingCp.id));
          } else {
            await tx.insert(contactCustomPrices).values(cp);
          }
        }
      }

      // Update Global Purchase Rates & History
      if (purchasePricesToUpdate.length > 0) {
        for (const update of purchasePricesToUpdate) {
          const { productOrVariant, isVariant, newCostPrice } = update;
          if (isVariant) {
            await tx
              .update(productVariants)
              .set({  updatedAt: new Date() })
              .where(eq(productVariants.id, productOrVariant.id));
          } else {
            await tx
              .update(products)
              .set({  updatedAt: new Date() })
              .where(eq(products.id, productOrVariant.id));
          }

          await tx.insert(productVariantPriceHistory).values({
            orgId,
            productId: isVariant ? productOrVariant.productId : productOrVariant.id,
            variantId: isVariant ? productOrVariant.id : null,
            
            
            
            mrp: productOrVariant.mrp,
            
            
            
            valuationCost: '0',
            
            
            
            createdBy: null,
          });
        }
      }

      return existingOrder;
    });
  }

  async updateOrderStatus(
    orgId: string, 
    userId: string, 
    orderId: string, 
    status: string, 
    warehouseId?: string,
    receivedItems?: { id: string; quantity: number }[]
  ) {
    return await db.transaction(async (tx) => {
      const order = await tx.query.orders.findFirst({
        where: and(eq(orders.id, orderId), eq(orders.orgId, orgId)),
        with: { items: true },
      });

      if (!order) throw new Error('Order not found');

      if (order.type === 'sales') {
        // Disallow cancelling an order once it is shipped or delivered
        if (status === 'cancelled' && (order.status === 'shipped' || order.status === 'delivered')) {
          throw new Error(`Order #${order.orderNumber} is already ${order.status} and cannot be cancelled.`);
        }

        // Cannot change status if already delivered
        if (order.status === 'delivered' && status !== 'delivered') {
          throw new Error(`Order #${order.orderNumber} is already delivered.`);
        }
      }

      // ── Purchase Orders: status changes are now managed by GRN creation ──
      // Allowed manual transitions for POs:
      //   draft → confirmed   (Approve PO)
      //   confirmed → cancelled (Cannot cancel once shipped/received)
      if (order.type === 'purchase') {
        const allowedTransitions: Record<string, string[]> = {
          draft: ['confirmed', 'cancelled'],
          confirmed: ['cancelled'],
          partially_received: [],
          fully_received: [],
          shipped: [],
        };
        const allowed = allowedTransitions[order.status] || [];
        if (!allowed.includes(status)) {
          throw new Error(
            `Cannot transition purchase order from '${order.status}' to '${status}'. ` +
            `Use Goods Receipts to record deliveries.`
          );
        }
        const [updated] = await tx.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, orderId)).returning();
        return updated;
      }

      // ── Sales Orders: stock adjustment on 'shipped' ──────────────────────
      if (order.type === 'sales' && status === 'shipped') {
        if (!warehouseId) throw new Error('Warehouse ID is required to process stock movement');

        for (const item of order.items) {
          if (item.baseQuantity === 0) continue;

          const quantityChange = -item.baseQuantity;

          let invRecord;
          if (item.variantId) {
            invRecord = await tx.query.inventory.findFirst({
              where: and(eq(inventory.orgId, orgId), eq(inventory.warehouseId, warehouseId), eq(inventory.productId, item.productId), eq(inventory.variantId, item.variantId)),
            });
          } else {
            invRecord = await tx.query.inventory.findFirst({
              where: and(eq(inventory.orgId, orgId), eq(inventory.warehouseId, warehouseId), eq(inventory.productId, item.productId), sql`${inventory.variantId} IS NULL`),
            });
          }

          let newQuantity = quantityChange;
          let inventoryId;

          if (invRecord) {
            newQuantity = invRecord.quantityOnHand + quantityChange;
            inventoryId = invRecord.id;
            await tx.update(inventory).set({ quantityOnHand: newQuantity, updatedAt: new Date() }).where(eq(inventory.id, inventoryId));
          } else {
            const [newRecord] = await tx.insert(inventory).values({
              orgId, warehouseId, productId: item.productId, variantId: item.variantId || null, quantityOnHand: newQuantity,
            }).returning();
            inventoryId = newRecord.id;
          }

          await tx.insert(inventoryTransactions).values({
            orgId,
            inventoryId,
            type: 'sale',
            quantityChange,
            quantityAfter: newQuantity,
            referenceType: 'order',
            referenceId: order.id,
            notes: `Sale Shipped - Order ${order.orderNumber}`,
            createdBy: userId,
          });
        }
      }

      const [updated] = await tx.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, orderId)).returning();
      return updated;
    });
  }


  async getOrderDetails(orgId: string, orderId: string) {
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.orgId, orgId)),
      with: {
        items: {
          with: { product: true, variant: true }
        },
        contact: true,
      }
    });
    
    if (order) {
      const orderDispatches = await db
        .select()
        .from(dispatches)
        .where(and(eq(dispatches.orderId, order.id), eq(dispatches.orgId, orgId)));
      
      (order as any).dispatches = orderDispatches;

      for (const item of order.items as any[]) {
        const [dispatchSumByItem] = await db.select({
          total: sql<number>`sum(${dispatchItems.quantity})`.mapWith(Number)
        }).from(dispatchItems).where(eq(dispatchItems.orderItemId, item.id));

        let dispatched = dispatchSumByItem?.total || 0;

        if (!dispatched && orderDispatches.length > 0) {
          const dispatchIds = orderDispatches.map(d => d.id);
          const [dispatchSumByOrder] = await db
            .select({
              total: sql<number>`sum(${dispatchItems.quantity})`.mapWith(Number)
            })
            .from(dispatchItems)
            .where(
              and(
                inArray(dispatchItems.dispatchId, dispatchIds),
                eq(dispatchItems.productId, item.productId),
                item.variantId ? eq(dispatchItems.variantId, item.variantId) : isNull(dispatchItems.variantId)
              )
            );
          dispatched = dispatchSumByOrder?.total || 0;
        }

        const ordered = Number(item.baseQuantity || item.orderQuantity || 0);
        item.orderedQuantity = ordered;
        item.dispatchedQuantity = dispatched;
        item.balanceQuantity = Math.max(0, ordered - dispatched);
      }
    }
    
    return order;
  }

  /**
   * Replenishment Engine
   * Calculates pending sales vs available stock and suggests purchase orders.
   */
  async getReplenishmentData(orgId: string) {
    // 1. Get all pending sales order items (draft, confirmed, processing)
    const pendingSales = await db
      .select({
        productId: orderItems.productId,
        variantId: orderItems.variantId,
        productName: products.name,
        productSku: products.sku,
        variantName: productVariants.name,
        variantSku: productVariants.sku,
        boxQuantity: products.boxQuantity,
        vBoxQuantity: productVariants.boxQuantity,
        
        vCostPrice: productVariants.valuationCost,
        pSupplierId: products.preferredSupplierId,
        vSupplierId: productVariants.preferredSupplierId,
        totalBaseOrdered: sql<number>`sum(${orderItems.baseQuantity})`.mapWith(Number),
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(products, eq(orderItems.productId, products.id))
      .leftJoin(productVariants, eq(orderItems.variantId, productVariants.id))
      .where(and(
        eq(orders.orgId, orgId),
        eq(orders.type, 'sales'),
        inArray(orders.status, ['confirmed', 'processing', 'partially_dispatched'])
      ))
      .groupBy(orderItems.productId, orderItems.variantId, products.name, products.sku, productVariants.name, productVariants.sku, products.boxQuantity, productVariants.boxQuantity, products.valuationCost, productVariants.valuationCost, products.preferredSupplierId, productVariants.preferredSupplierId);

    // 2. Get available stock for all items
    const stockData = await db
      .select({
        productId: inventory.productId,
        variantId: inventory.variantId,
        totalStock: sql<number>`sum(${inventory.quantityOnHand})`.mapWith(Number),
      })
      .from(inventory)
      .where(eq(inventory.orgId, orgId))
      .groupBy(inventory.productId, inventory.variantId);

    // 2.5 Get pending purchases (ordered but not received)
    const pendingPurchaseOrders = await db
      .select({
        id: orderItems.id,
        productId: orderItems.productId,
        variantId: orderItems.variantId,
        baseQuantity: orderItems.baseQuantity,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(
        eq(orders.orgId, orgId),
        eq(orders.type, 'purchase'),
        inArray(orders.status, ['draft', 'confirmed', 'shipped'])
      ));

    // Get all received quantities for these pending purchase items
    let receivedMap = new Map();
    if (pendingPurchaseOrders.length > 0) {
      const receivedGrnItems = await db
        .select({
          orderItemId: goodsReceiptItems.orderItemId,
          totalReceived: sql<number>`sum(${goodsReceiptItems.receivedQty})`.mapWith(Number),
        })
        .from(goodsReceiptItems)
        .innerJoin(goodsReceipts, eq(goodsReceiptItems.receiptId, goodsReceipts.id))
        .where(and(
          eq(goodsReceiptItems.orgId, orgId),
          inArray(goodsReceiptItems.orderItemId, pendingPurchaseOrders.map(p => p.id).filter(Boolean))
        ))
        .groupBy(goodsReceiptItems.orderItemId);

      receivedGrnItems.forEach(r => {
        if (r.orderItemId) receivedMap.set(r.orderItemId, r.totalReceived);
      });
    }

    const pendingPurchaseMap = new Map(); // key: productId::variantId
    pendingPurchaseOrders.forEach(p => {
      const key = `${p.productId}::${p.variantId || ''}`;
      const received = receivedMap.get(p.id) || 0;
      const pending = Math.max(0, p.baseQuantity - received);
      pendingPurchaseMap.set(key, (pendingPurchaseMap.get(key) || 0) + pending);
    });

    // 3. Compare and calculate deficit
    const results = [];

    for (const sale of pendingSales) {
      const stock = stockData.find(s => s.productId === sale.productId && s.variantId === sale.variantId);
      const available = stock ? stock.totalStock : 0;
      
      const key = `${sale.productId}::${sale.variantId || ''}`;
      const pendingPurchases = pendingPurchaseMap.get(key) || 0;
        
      const deficit = sale.totalBaseOrdered - available - pendingPurchases;

      if (deficit > 0) {
        const boxQty = sale.vBoxQuantity || sale.boxQuantity || 1;
        const suggestedBoxes = Math.ceil(deficit / boxQty);

        results.push({
          productId: sale.productId,
          variantId: sale.variantId,
          productName: sale.productName,
          variantName: sale.variantName,
          sku: sale.variantSku || sale.productSku,
          pendingSales: sale.totalBaseOrdered,
          availableStock: available,
          pendingPurchases,
          deficitLoose: deficit,
          boxQuantity: boxQty,
          
          vCostPrice: sale.vCostPrice,
          preferredSupplierId: sale.vSupplierId || sale.pSupplierId || null,
          suggestedBoxes,
        });
      }
    }

    return results;
  }

  async createReplenishmentDrafts(orgId: string, userId: string, items: any[]) {
    if (!items || items.length === 0) {
      throw new Error('No items provided for replenishment');
    }

    // Group items by preferredSupplierId
    const supplierGroups: Record<string, any[]> = {};
    for (const item of items) {
      if (!item.preferredSupplierId) {
        throw new Error(`Item ${item.sku} has no supplier assigned.`);
      }
      if (!supplierGroups[item.preferredSupplierId]) {
        supplierGroups[item.preferredSupplierId] = [];
      }
      supplierGroups[item.preferredSupplierId].push(item);
    }

    return await db.transaction(async (tx) => {
      const createdOrders = [];

      for (const [supplierId, supplierItems] of Object.entries(supplierGroups)) {
        const prefix = 'PO-';
        const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
        const orderNumber = `${prefix}${new Date().getFullYear()}-${randomSuffix}`;

        const [order] = await tx.insert(orders).values({
          orgId,
          orderNumber,
          type: 'purchase',
          contactId: supplierId,
          status: 'draft',
          orderDate: new Date().toISOString().split('T')[0],
          totalAmount: '0',
          notes: 'Auto-generated from Replenishment Engine',
          createdBy: userId,
        }).returning();

        let grandTotal = 0;

        for (const item of supplierItems) {
          const baseQty = item.suggestedBoxes * item.boxQuantity;
          const unitPriceStr = item.vCostPrice || item.valuationCost || '0';
          const unitPrice = parseFloat(unitPriceStr);
          const totalPrice = unitPrice * baseQty;

          grandTotal += totalPrice;

          await tx.insert(orderItems).values({
            orgId,
            orderId: order.id,
            productId: item.productId,
            variantId: item.variantId || null,
            unitType: 'box',
            orderQuantity: item.suggestedBoxes,
            baseQuantity: baseQty,
            unitPrice: unitPrice.toFixed(2),
            totalPrice: totalPrice.toFixed(2),
          });
        }

        await tx.update(orders).set({ totalAmount: grandTotal.toFixed(2) }).where(eq(orders.id, order.id));
        createdOrders.push({ ...order, totalAmount: grandTotal.toFixed(2) });
      }

      return createdOrders;
    });
  }

  async generateFulfillment(orgId: string, userId: string, orderId: string) {
    return await db.transaction(async (tx) => {
      const order = await tx.query.orders.findFirst({
        where: and(eq(orders.id, orderId), eq(orders.orgId, orgId)),
        with: { items: true },
      });

      if (!order) throw new Error('Order not found');
      if (order.type !== 'sales') throw new Error('Fulfillment is only for sales orders');
      if (order.status !== 'confirmed' && order.status !== 'processing') {
        throw new Error('Order must be in confirmed or processing status');
      }

      // Check inventory
      const stockData = await tx.select({
        productId: inventory.productId,
        variantId: inventory.variantId,
        totalStock: sql<number>`sum(${inventory.quantityOnHand})`.mapWith(Number),
      }).from(inventory).where(eq(inventory.orgId, orgId)).groupBy(inventory.productId, inventory.variantId);

      const itemsToPurchase = [];
      const itemsToDispatch = [];

      for (const item of order.items) {
        const stock = stockData.find(s => s.productId === item.productId && s.variantId === item.variantId);
        const available = stock ? stock.totalStock : 0;
        

        if (available < item.baseQuantity) {
                              itemsToPurchase.push({ ...item, deficit: item.baseQuantity - available });
        } else {
                              itemsToDispatch.push(item);
        }
      }

      if (itemsToPurchase.length > 0) {
        // Need to create purchase order
        const poNumber = `PO-${Date.now().toString().slice(-6)}`;
        const [po] = await tx.insert(orders).values({
          orgId,
          type: 'purchase',
          orderNumber: poNumber,
          status: 'draft',
          orderDate: new Date().toISOString().split('T')[0],
          totalAmount: '0', // Can calculate if we know unit price
          notes: `Auto-generated to fulfill sales order ${order.orderNumber}`,
          createdBy: userId,
        }).returning();

        for (const pItem of itemsToPurchase) {
          await tx.insert(orderItems).values({
            orgId,
            orderId: po.id,
            productId: pItem.productId,
            variantId: pItem.variantId,
            orderQuantity: pItem.deficit,
            baseQuantity: pItem.deficit,
            unitPrice: '0',
            totalPrice: '0',
          });
        }
        
        await tx.update(orders).set({ status: 'processing', updatedAt: new Date() }).where(eq(orders.id, orderId));
        return { type: 'purchase_order_created', order: po, message: 'Not enough stock. Draft Purchase Order created.' };
      } else {
        // We have stock, create dispatch
        const dispatchNumber = `DSP-${Date.now().toString().slice(-6)}`;
        // Since we import dispatches inside the method to avoid circular dependency or import at top
        const { dispatches, dispatchItems } = await import('../../db/schema/dispatches.js');
        const [dispatch] = await tx.insert(dispatches).values({
          orgId,
          orderId,
          dispatchNumber,
          status: 'draft',
        }).returning();

        for (const item of order.items) {
          await tx.insert(dispatchItems).values({
            dispatchId: dispatch.id,
            orderItemId: item.id,
            quantity: item.baseQuantity,
          });
        }
        
        await tx.update(orders).set({ status: 'processing', updatedAt: new Date() }).where(eq(orders.id, orderId));
        return { type: 'dispatch_created', dispatch, message: 'Stock available. Draft Dispatch created.' };
      }
    });
  }

  /**
   * Pending orders report: party-wise grouping with items and quantities.
   */
  async getPendingOrdersPartyWise(orgId: string, type: 'sales' | 'purchase' = 'sales') {
    const pendingStatuses = type === 'sales'
      ? ['draft', 'confirmed', 'processing', 'partially_dispatched']
      : ['draft', 'confirmed', 'shipped'];

    const pendingOrdersList = await db.query.orders.findMany({
      where: and(
        eq(orders.orgId, orgId),
        eq(orders.type, type),
        inArray(orders.status, pendingStatuses)
      ),
      with: {
        contact: true,
        items: {
          with: {
            product: true,
            variant: true,
          }
        }
      },
      orderBy: [asc(orders.orderDate), desc(orders.createdAt)]
    });

    // Group by contact (party)
    const partyMap = new Map<string, {
      partyId: string;
      partyName: string;
      partyPhone?: string | null;
      partyEmail?: string | null;
      partyGstin?: string | null;
      ordersCount: number;
      totalPendingAmount: number;
      orders: any[];
    }>();

    for (const order of pendingOrdersList) {
      const partyId = order.contactId || 'unknown';
      const partyName = order.contact?.displayName || order.contact?.companyName || 'Walk-in / Direct';
      
      if (!partyMap.has(partyId)) {
        partyMap.set(partyId, {
          partyId,
          partyName,
          partyPhone: order.contact?.phone,
          partyEmail: order.contact?.email,
          partyGstin: order.contact?.gstin,
          ordersCount: 0,
          totalPendingAmount: 0,
          orders: [],
        });
      }

      const partyEntry = partyMap.get(partyId)!;
      partyEntry.ordersCount += 1;
      
      // Fetch any linked dispatches for this order
      const orderDispatches = await db
        .select({ id: dispatches.id })
        .from(dispatches)
        .where(and(eq(dispatches.orderId, order.id), eq(dispatches.orgId, orgId)));
      const dispatchIds = orderDispatches.map(d => d.id);

      let orderPendingBalanceTotal = 0;

      const mappedItems = [];
      for (const item of order.items) {
        const [dispatchSumByItem] = await db.select({
          total: sql<number>`sum(${dispatchItems.quantity})`.mapWith(Number)
        }).from(dispatchItems).where(eq(dispatchItems.orderItemId, item.id));

        let dispatched = dispatchSumByItem?.total || 0;

        if (!dispatched && dispatchIds.length > 0) {
          const [dispatchSumByOrder] = await db
            .select({
              total: sql<number>`sum(${dispatchItems.quantity})`.mapWith(Number)
            })
            .from(dispatchItems)
            .where(
              and(
                inArray(dispatchItems.dispatchId, dispatchIds),
                eq(dispatchItems.productId, item.productId),
                item.variantId ? eq(dispatchItems.variantId, item.variantId) : isNull(dispatchItems.variantId)
              )
            );
          dispatched = dispatchSumByOrder?.total || 0;
        }

        const orderedQty = Number(item.orderQuantity || 0);
        const baseQty = Number(item.baseQuantity || 0);
        const unitPrice = Number(item.unitPrice || 0);
        const balanceQty = Math.max(0, baseQty - dispatched);
        const balanceAmount = balanceQty * unitPrice;

        orderPendingBalanceTotal += balanceAmount;

        mappedItems.push({
          id: item.id,
          productName: item.product?.name || 'Item',
          productSku: item.product?.sku || '',
          variantName: item.variant?.name || '',
          variantSku: item.variant?.sku || '',
          orderQuantity: orderedQty,
          unitType: item.unitType || 'piece',
          baseQuantity: baseQty,
          dispatchedQuantity: dispatched,
          balanceQuantity: balanceQty,
          unitPrice: unitPrice,
          totalPrice: Number(item.totalPrice || 0),
          balanceAmount: balanceAmount,
        });
      }

      partyEntry.totalPendingAmount += orderPendingBalanceTotal > 0 ? orderPendingBalanceTotal : Number(order.totalAmount || 0);

      partyEntry.orders.push({
        id: order.id,
        orderNumber: order.orderNumber,
        orderDate: order.orderDate,
        status: order.status,
        totalAmount: Number(order.totalAmount || 0),
        pendingBalanceAmount: orderPendingBalanceTotal,
        notes: order.notes,
        items: mappedItems,
      });
    }

    return Array.from(partyMap.values());
  }

  /**
   * Bulk updates order statuses (e.g. bulk confirm, bulk cancel).
   */
  async bulkUpdateOrderStatus(orgId: string, userId: string, orderIds: string[], status: 'draft' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled') {
    if (!orderIds || orderIds.length === 0) return { updated: 0, errors: [] };

    let count = 0;
    const errors: string[] = [];

    for (const id of orderIds) {
      try {
        await this.updateOrderStatus(orgId, userId, id, status);
        count++;
      } catch (e: any) {
        console.error(`Failed to update order ${id} in bulk:`, e.message);
        errors.push(e.message || `Failed to update order ${id}`);
      }
    }

    if (count === 0 && errors.length > 0) {
      throw new Error(errors[0]);
    }

    return { updated: count, total: orderIds.length, errors };
  }
}

export const ordersService = new OrdersService();

