import { db } from '../../config/database.js';
import { warehouses, inventory, inventoryTransactions, orders, orderItems } from '../../db/schema/index.js';
import { eq, and, desc, asc, sql, ilike, or } from 'drizzle-orm';
import { products, productVariants } from '../../db/schema/products.js';

export class InventoryService {
  /**
   * List all warehouses for an organization
   */
  async listWarehouses(orgId: string) {
    return await db
      .select()
      .from(warehouses)
      .where(
        and(
          eq(warehouses.orgId, orgId),
          eq(warehouses.isActive, true),
          sql`${warehouses.deletedAt} IS NULL`
        )
      )
      .orderBy(desc(warehouses.createdAt));
  }

  /**
   * Create a new warehouse
   */
  async createWarehouse(orgId: string, data: any) {
    if (data.isDefault) {
      // Unset any existing default warehouse
      await db
        .update(warehouses)
        .set({ isDefault: false })
        .where(eq(warehouses.orgId, orgId));
    }

    const [warehouse] = await db
      .insert(warehouses)
      .values({
        orgId,
        ...data,
      })
      .returning();

    return warehouse;
  }

  /**
   * List stock details across products and variants
   */
  async listStock(
    orgId: string,
    options: {
      warehouseId?: string;
      search?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ) {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;

    const conditions = [eq(inventory.orgId, orgId)];
    if (options.warehouseId) {
      conditions.push(eq(inventory.warehouseId, options.warehouseId));
    }

    if (options.search) {
      const searchPattern = `%${options.search}%`;
      const searchOr = or(
        ilike(products.name, searchPattern),
        ilike(products.sku, searchPattern),
        ilike(productVariants.name, searchPattern),
        ilike(productVariants.sku, searchPattern)
      );
      if (searchOr) {
        conditions.push(searchOr);
      }
    }

    const whereClause = and(...conditions);

    // Count query
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(inventory)
      .innerJoin(warehouses, eq(inventory.warehouseId, warehouses.id))
      .innerJoin(products, eq(inventory.productId, products.id))
      .leftJoin(productVariants, eq(inventory.variantId, productVariants.id))
      .where(whereClause);

    const total = countResult?.count || 0;
    const totalPages = Math.ceil(total / limit);

    const data = await db
      .select({
        inventoryId: inventory.id,
        warehouseId: inventory.warehouseId,
        warehouseName: warehouses.name,
        productId: inventory.productId,
        productName: products.name,
        productSku: products.sku,
        variantId: inventory.variantId,
        variantName: productVariants.name,
        variantSku: productVariants.sku,
        quantityOnHand: inventory.quantityOnHand,
        quantityReserved: inventory.quantityReserved,
        boxQuantity: sql<number>`COALESCE(${productVariants.boxQuantity}, ${products.boxQuantity}, 1)::int`,
        pendingOrderQuantity: sql<number>`COALESCE((
          SELECT SUM(oi.base_quantity)
          FROM ${orderItems} oi
          JOIN ${orders} o ON o.id = oi.order_id
          WHERE o.org_id = ${orgId}
            AND o.type = 'purchase'
            AND o.status = 'confirmed'
            AND oi.product_id = ${inventory.productId}
            AND (oi.variant_id = ${inventory.variantId} OR (${inventory.variantId} IS NULL AND oi.variant_id IS NULL))
        ), 0)::int`,
        updatedAt: inventory.updatedAt,
      })
      .from(inventory)
      .innerJoin(warehouses, eq(inventory.warehouseId, warehouses.id))
      .innerJoin(products, eq(inventory.productId, products.id))
      .leftJoin(productVariants, eq(inventory.variantId, productVariants.id))
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(
        (() => {
          const orderFn = options.sortOrder === 'asc' ? asc : desc;
          if (options.sortBy === 'productName') return orderFn(products.name);
          if (options.sortBy === 'quantityOnHand') return orderFn(inventory.quantityOnHand);
          if (options.sortBy === 'warehouseName') return orderFn(warehouses.name);
          if (options.sortBy === 'updatedAt') return orderFn(inventory.updatedAt);
          return orderFn(inventory.updatedAt);
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

  /**
   * Adjust stock levels for a product/variant at a warehouse
   */
  async adjustStock(orgId: string, userId: string, data: {
    warehouseId: string;
    productId: string;
    variantId?: string | null;
    quantityChange: number;
    notes?: string;
  }) {
    return await db.transaction(async (tx) => {
      let invRecord;

      // Find existing inventory record
      if (data.variantId) {
        invRecord = await tx.query.inventory.findFirst({
          where: and(
            eq(inventory.orgId, orgId),
            eq(inventory.warehouseId, data.warehouseId),
            eq(inventory.productId, data.productId),
            eq(inventory.variantId, data.variantId)
          ),
        });
      } else {
        invRecord = await tx.query.inventory.findFirst({
          where: and(
            eq(inventory.orgId, orgId),
            eq(inventory.warehouseId, data.warehouseId),
            eq(inventory.productId, data.productId),
            sql`${inventory.variantId} IS NULL`
          ),
        });
      }

      let newQuantity = data.quantityChange;
      let inventoryId;

      if (invRecord) {
        newQuantity = invRecord.quantityOnHand + data.quantityChange;
        inventoryId = invRecord.id;

        // Update existing record
        await tx
          .update(inventory)
          .set({
            quantityOnHand: newQuantity,
            updatedAt: new Date(),
          })
          .where(eq(inventory.id, inventoryId));
      } else {
        // Create new inventory record if it doesn't exist (initial stock adjustment)
        const [newRecord] = await tx
          .insert(inventory)
          .values({
            orgId,
            warehouseId: data.warehouseId,
            productId: data.productId,
            variantId: data.variantId || null,
            quantityOnHand: newQuantity,
          })
          .returning();
        
        inventoryId = newRecord.id;
      }

      // Record transaction
      const [txRecord] = await tx
        .insert(inventoryTransactions)
        .values({
          orgId,
          inventoryId,
          type: data.quantityChange > 0 ? 'adjustment_in' : 'adjustment_out',
          quantityChange: data.quantityChange,
          quantityAfter: newQuantity,
          notes: data.notes || 'Manual stock adjustment',
          createdBy: userId,
        })
        .returning();

      return txRecord;
    });
  }

  /**
   * List inventory transactions
   */
  async listTransactions(
    orgId: string,
    filters: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ) {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const offset = (page - 1) * limit;

    const conditions = [eq(inventoryTransactions.orgId, orgId)];
    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(inventoryTransactions)
      .where(whereClause);

    const total = countResult?.count || 0;
    const totalPages = Math.ceil(total / limit);

    const data = await db
      .select({
        id: inventoryTransactions.id,
        type: inventoryTransactions.type,
        quantityChange: inventoryTransactions.quantityChange,
        quantityAfter: inventoryTransactions.quantityAfter,
        notes: inventoryTransactions.notes,
        createdAt: inventoryTransactions.createdAt,
        warehouseName: warehouses.name,
        productName: products.name,
        variantName: productVariants.name,
      })
      .from(inventoryTransactions)
      .innerJoin(inventory, eq(inventoryTransactions.inventoryId, inventory.id))
      .innerJoin(warehouses, eq(inventory.warehouseId, warehouses.id))
      .innerJoin(products, eq(inventory.productId, products.id))
      .leftJoin(productVariants, eq(inventory.variantId, productVariants.id))
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(
        (() => {
          const orderFn = filters.sortOrder === 'asc' ? asc : desc;
          if (filters.sortBy === 'quantityChange') return orderFn(inventoryTransactions.quantityChange);
          if (filters.sortBy === 'quantityAfter') return orderFn(inventoryTransactions.quantityAfter);
          if (filters.sortBy === 'productName') return orderFn(products.name);
          if (filters.sortBy === 'warehouseName') return orderFn(warehouses.name);
          if (filters.sortBy === 'createdAt') return orderFn(inventoryTransactions.createdAt);
          return orderFn(inventoryTransactions.createdAt);
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
}

export const inventoryService = new InventoryService();
