import { pgTable, uuid, numeric, timestamp, uniqueIndex, varchar, date } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { organizations } from './organizations.js';
import { contacts } from './contacts.js';
import { products, productVariants } from './products.js';

export const contactCustomPriceTypeEnum = varchar('type', { length: 20 }).$type<'sales' | 'purchase'>();

export const contactCustomPrices = pgTable(
  'contact_custom_prices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .references(() => productVariants.id, { onDelete: 'cascade' }),

    customPrice: numeric('custom_price', { precision: 15, scale: 2 }).notNull(),
    type: contactCustomPriceTypeEnum.default('sales').notNull(),
    validFrom: date('valid_from'),
    validTo: date('valid_to'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('contact_custom_price_variant_unique_idx')
      .on(table.orgId, table.contactId, table.productId, table.variantId, table.type)
      .where(sql`${table.variantId} is not null`),
    uniqueIndex('contact_custom_price_product_unique_idx')
      .on(table.orgId, table.contactId, table.productId, table.type)
      .where(sql`${table.variantId} is null`),
  ]
);

export const contactCustomPricesRelations = relations(contactCustomPrices, ({ one }) => ({
  organization: one(organizations, {
    fields: [contactCustomPrices.orgId],
    references: [organizations.id],
  }),
  contact: one(contacts, {
    fields: [contactCustomPrices.contactId],
    references: [contacts.id],
  }),
  product: one(products, {
    fields: [contactCustomPrices.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [contactCustomPrices.variantId],
    references: [productVariants.id],
  }),
}));

export type ContactCustomPrice = typeof contactCustomPrices.$inferSelect;
export type NewContactCustomPrice = typeof contactCustomPrices.$inferInsert;
