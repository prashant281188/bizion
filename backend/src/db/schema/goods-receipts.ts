import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  integer,
  date,
  timestamp,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations.js';
import { orders, orderItems } from './orders.js';
import { products, productVariants } from './products.js';
import { warehouses } from './inventory.js';
import { users } from './users.js';
import { invoices } from './invoices.js';

/**
 * Goods Receipts — records of physical goods received from a supplier.
 * A single Purchase Order can have multiple GRNs (partial deliveries / lots).
 * Each GRN triggers an inventory stock increment and creates an audit trail.
 */
export const goodsReceipts = pgTable('goods_receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'restrict' }),
  receiptNumber: varchar('receipt_number', { length: 50 }).notNull(),
  receiptDate: date('receipt_date').notNull(),
  warehouseId: uuid('warehouse_id')
    .notNull()
    .references(() => warehouses.id, { onDelete: 'restrict' }),
  status: varchar('status', { length: 20 }).default('approved').notNull(), // 'draft' | 'approved'
  notes: text('notes'),
  invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const goodsReceiptsRelations = relations(goodsReceipts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [goodsReceipts.orgId],
    references: [organizations.id],
  }),
  order: one(orders, {
    fields: [goodsReceipts.orderId],
    references: [orders.id],
  }),
  warehouse: one(warehouses, {
    fields: [goodsReceipts.warehouseId],
    references: [warehouses.id],
  }),
  invoice: one(invoices, {
    fields: [goodsReceipts.invoiceId],
    references: [invoices.id],
  }),
  creator: one(users, {
    fields: [goodsReceipts.createdBy],
    references: [users.id],
  }),
  items: many(goodsReceiptItems),
}));

/**
 * Goods Receipt Items — line items for each GRN.
 * Links back to the original order_items to track fulfillment progress.
 */
export const goodsReceiptItems = pgTable('goods_receipt_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  receiptId: uuid('receipt_id')
    .notNull()
    .references(() => goodsReceipts.id, { onDelete: 'cascade' }),
  orderItemId: uuid('order_item_id').references(() => orderItems.id, { onDelete: 'set null' }),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
  orderedQty: integer('ordered_qty').notNull().default(0),
  receivedQty: integer('received_qty').notNull().default(0),
  unitPrice: numeric('unit_price', { precision: 15, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const goodsReceiptItemsRelations = relations(goodsReceiptItems, ({ one }) => ({
  organization: one(organizations, {
    fields: [goodsReceiptItems.orgId],
    references: [organizations.id],
  }),
  receipt: one(goodsReceipts, {
    fields: [goodsReceiptItems.receiptId],
    references: [goodsReceipts.id],
  }),
  orderItem: one(orderItems, {
    fields: [goodsReceiptItems.orderItemId],
    references: [orderItems.id],
  }),
  product: one(products, {
    fields: [goodsReceiptItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [goodsReceiptItems.variantId],
    references: [productVariants.id],
  }),
}));

export type GoodsReceipt = typeof goodsReceipts.$inferSelect;
export type NewGoodsReceipt = typeof goodsReceipts.$inferInsert;
export type GoodsReceiptItem = typeof goodsReceiptItems.$inferSelect;
export type NewGoodsReceiptItem = typeof goodsReceiptItems.$inferInsert;
