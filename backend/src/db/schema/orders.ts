import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  integer,
  timestamp,
  date,
  boolean,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations.js';
import { contacts } from './contacts.js';
import { products, productVariants } from './products.js';
import { users } from './users.js';
import { taxRates } from './masters.js';

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  orderNumber: varchar('order_number', { length: 50 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // 'sales' or 'purchase'
  status: varchar('status', { length: 20 }).default('draft').notNull(), // draft, confirmed, shipped, delivered, cancelled
  
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  
  orderDate: date('order_date').notNull(),
  expectedDeliveryDate: date('expected_delivery_date'),
  
  isInterState: boolean('is_inter_state').default(false).notNull(),
  taxableAmount: numeric('taxable_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  cgstAmount: numeric('cgst_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  sgstAmount: numeric('sgst_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  igstAmount: numeric('igst_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  totalTaxAmount: numeric('total_tax_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  roundOff: numeric('round_off', { precision: 15, scale: 2 }).default('0').notNull(),
  totalAmount: numeric('total_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  notes: text('notes'),
  
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const ordersRelations = relations(orders, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [orders.orgId],
    references: [organizations.id],
  }),
  contact: one(contacts, {
    fields: [orders.contactId],
    references: [contacts.id],
  }),
  creator: one(users, {
    fields: [orders.createdBy],
    references: [users.id],
  }),
  items: many(orderItems),
}));

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
  
  unitType: varchar('unit_type', { length: 20 }).default('loose').notNull(), // 'box' or 'loose'
  orderQuantity: integer('order_quantity').notNull(), // How many units (boxes or loose) ordered
  baseQuantity: integer('base_quantity').notNull(), // Total loose items (e.g. 2 boxes * 10 = 20)
  
  unitPrice: numeric('unit_price', { precision: 15, scale: 2 }).default('0').notNull(),
  taxableValue: numeric('taxable_value', { precision: 15, scale: 2 }).default('0').notNull(),
  
  taxRateId: uuid('tax_rate_id').references(() => taxRates.id, { onDelete: 'set null' }),
  taxRatePercent: numeric('tax_rate_percent', { precision: 5, scale: 2 }).default('0').notNull(),
  cgstAmount: numeric('cgst_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  sgstAmount: numeric('sgst_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  igstAmount: numeric('igst_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  
  totalPrice: numeric('total_price', { precision: 15, scale: 2 }).default('0').notNull(), // includes tax
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  organization: one(organizations, {
    fields: [orderItems.orgId],
    references: [organizations.id],
  }),
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [orderItems.variantId],
    references: [productVariants.id],
  }),
  taxRate: one(taxRates, {
    fields: [orderItems.taxRateId],
    references: [taxRates.id],
  }),
}));

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
