import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations.js';
import { products, productVariants } from './products.js';
import { users } from './users.js';

/**
 * Warehouses — physical locations where inventory is stored.
 * Each org can have multiple warehouses with state codes for GST supply determination.
 */
export const warehouses = pgTable('warehouses', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),

  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 20 }).notNull(),

  addressLine1: text('address_line1'),
  addressLine2: text('address_line2'),
  city: varchar('city', { length: 100 }),
  stateCode: varchar('state_code', { length: 2 }),
  stateName: varchar('state_name', { length: 100 }),
  pincode: varchar('pincode', { length: 6 }),
  country: varchar('country', { length: 100 }).default('India'),

  isDefault: boolean('is_default').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const warehousesRelations = relations(warehouses, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [warehouses.orgId],
    references: [organizations.id],
  }),
  inventoryItems: many(inventory),
}));

/**
 * Inventory — stock levels per product/variant per warehouse.
 * Tracks on-hand quantity, reserved quantity, and reorder thresholds.
 */
export const inventory = pgTable('inventory', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
  warehouseId: uuid('warehouse_id')
    .notNull()
    .references(() => warehouses.id, { onDelete: 'cascade' }),

  quantityOnHand: integer('quantity_on_hand').default(0).notNull(),
  quantityReserved: integer('quantity_reserved').default(0).notNull(),
  reorderLevel: integer('reorder_level').default(0).notNull(),
  reorderQuantity: integer('reorder_quantity').default(0).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const inventoryRelations = relations(inventory, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [inventory.orgId],
    references: [organizations.id],
  }),
  product: one(products, {
    fields: [inventory.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [inventory.variantId],
    references: [productVariants.id],
  }),
  warehouse: one(warehouses, {
    fields: [inventory.warehouseId],
    references: [warehouses.id],
  }),
  transactions: many(inventoryTransactions),
}));

/**
 * Inventory Transactions — audit trail of all stock movements.
 * Records the type of movement, quantity change, and the reference document.
 */
export const inventoryTransactions = pgTable('inventory_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  inventoryId: uuid('inventory_id')
    .notNull()
    .references(() => inventory.id, { onDelete: 'cascade' }),

  // Type: purchase, sale, adjustment, transfer, return, opening_stock
  type: varchar('type', { length: 50 }).notNull(),
  quantityChange: integer('quantity_change').notNull(),
  quantityAfter: integer('quantity_after').notNull(),

  // Source document reference (e.g., invoice_id, purchase_order_id)
  referenceType: varchar('reference_type', { length: 50 }),
  referenceId: uuid('reference_id'),

  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const inventoryTransactionsRelations = relations(inventoryTransactions, ({ one }) => ({
  organization: one(organizations, {
    fields: [inventoryTransactions.orgId],
    references: [organizations.id],
  }),
  inventoryItem: one(inventory, {
    fields: [inventoryTransactions.inventoryId],
    references: [inventory.id],
  }),
  creator: one(users, {
    fields: [inventoryTransactions.createdBy],
    references: [users.id],
  }),
}));

export type Warehouse = typeof warehouses.$inferSelect;
export type NewWarehouse = typeof warehouses.$inferInsert;
export type Inventory = typeof inventory.$inferSelect;
export type NewInventory = typeof inventory.$inferInsert;
export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;
export type NewInventoryTransaction = typeof inventoryTransactions.$inferInsert;
