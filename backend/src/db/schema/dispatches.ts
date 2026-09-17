import { pgTable, uuid, timestamp, varchar, integer, numeric, text, jsonb } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { orders, orderItems } from './orders.js';
import { contacts } from './contacts.js';
import { products, productVariants } from './products.js';

// Status enum for dispatches
export const dispatchStatusEnum = ['draft', 'approved', 'shipped', 'delivered', 'cancelled'] as const;

export const dispatches = pgTable('dispatches', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id),
  orderId: uuid('order_id')
    .references(() => orders.id),
  contactId: uuid('contact_id')
    .references(() => contacts.id),
  
  dispatchNumber: varchar('dispatch_number', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().$type<typeof dispatchStatusEnum[number]>(),
  
  carrierName: varchar('carrier_name', { length: 100 }),
  trackingNumber: varchar('tracking_number', { length: 100 }),
  estimatedDeliveryDate: timestamp('estimated_delivery_date'),
  actualDeliveryDate: timestamp('actual_delivery_date'),
  
  notes: text('notes'),
  
  metadata: jsonb('metadata'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

export const dispatchItems = pgTable('dispatch_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  dispatchId: uuid('dispatch_id')
    .notNull()
    .references(() => dispatches.id, { onDelete: 'cascade' }),
  orderItemId: uuid('order_item_id')
    .references(() => orderItems.id),
  productId: uuid('product_id')
    .references(() => products.id),
  variantId: uuid('variant_id')
    .references(() => productVariants.id),
  unitType: varchar('unit_type', { length: 20 }).default('loose'),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }),
  quantity: integer('quantity').notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
