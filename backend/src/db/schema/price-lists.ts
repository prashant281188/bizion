import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  boolean,
  date,
  integer,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { organizations } from './organizations.js';
import { products, productVariants } from './products.js';
import { users } from './users.js';

export const priceListTypeEnum = varchar('type', { length: 20 }).$type<'sales' | 'purchase'>();

export const priceLists = pgTable('price_lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  name: varchar('name', { length: 255 }).notNull(),
  type: priceListTypeEnum.default('sales').notNull(),
  isGlobalDefault: boolean('is_global_default').default(false).notNull(),
  currency: varchar('currency', { length: 3 }).default('INR').notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),

  createdBy: uuid('created_by').references((): any => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const priceListsRelations = relations(priceLists, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [priceLists.orgId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [priceLists.createdBy],
    references: [users.id],
  }),
  items: many(priceListItems),
}));

export const priceListItems = pgTable('price_list_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  priceListId: uuid('price_list_id')
    .notNull()
    .references(() => priceLists.id, { onDelete: 'cascade' }),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id')
    .references(() => productVariants.id, { onDelete: 'cascade' }),

  basePrice: numeric('base_price', { precision: 15, scale: 2 }).default('0').notNull(),
  sellingPrice: numeric('selling_price', { precision: 15, scale: 2 }).default('0').notNull(),
  listPrice: numeric('list_price', { precision: 15, scale: 2 }).default('0').notNull(),
  
  minQuantity: integer('min_quantity').default(1).notNull(),
  
  validFrom: date('valid_from'),
  validTo: date('valid_to'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('price_list_item_variant_unique_idx')
    .on(table.priceListId, table.productId, table.variantId, table.minQuantity)
    .where(sql`${table.variantId} is not null`),
  uniqueIndex('price_list_item_product_unique_idx')
    .on(table.priceListId, table.productId, table.minQuantity)
    .where(sql`${table.variantId} is null`),
]);

export const priceListItemsRelations = relations(priceListItems, ({ one }) => ({
  organization: one(organizations, {
    fields: [priceListItems.orgId],
    references: [organizations.id],
  }),
  priceList: one(priceLists, {
    fields: [priceListItems.priceListId],
    references: [priceLists.id],
  }),
  product: one(products, {
    fields: [priceListItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [priceListItems.variantId],
    references: [productVariants.id],
  }),
}));
