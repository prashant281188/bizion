import {
  pgTable,
  uuid,
  varchar,
  numeric,
  boolean,
  date,
  integer,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { organizations } from './organizations.js';
import { products, productVariants } from './products.js';
import { categories, brands } from './masters.js';
import { users } from './users.js';

export const promoDiscountTypeEnum = varchar('discount_type', { length: 20 }).$type<'percentage' | 'flat_amount'>();
export const promoTypeEnum = varchar('promo_type', { length: 50 }).$type<'clearance_sale' | 'special_offer' | 'seasonal_sale' | 'flash_sale' | 'bulk_deal' | 'custom'>();
export const appliesToEnum = varchar('applies_to', { length: 30 }).$type<'all_products' | 'specific_brands' | 'specific_products' | 'specific_variants' | 'specific_categories'>();

export const promotionalSchemes = pgTable('promotional_schemes', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  name: varchar('name', { length: 255 }).notNull(),
  promoType: promoTypeEnum.default('special_offer').notNull(),
  badgeText: varchar('badge_text', { length: 100 }), // e.g. "50% OFF", "Clearance", "Limited Time"
  description: text('description'),
  
  discountType: promoDiscountTypeEnum.notNull(),
  discountValue: numeric('discount_value', { precision: 10, scale: 2 }).notNull(),
  
  minQuantity: integer('min_quantity').default(1).notNull(),
  maxDiscountAmount: numeric('max_discount_amount', { precision: 15, scale: 2 }), // Cap for percentage discounts
  
  validFrom: date('valid_from').notNull(),
  validTo: date('valid_to').notNull(),
  
  isActive: boolean('is_active').default(true).notNull(),
  priority: integer('priority').default(0).notNull(),
  appliesTo: appliesToEnum.default('all_products').notNull(),

  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const promotionalSchemesRelations = relations(promotionalSchemes, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [promotionalSchemes.orgId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [promotionalSchemes.createdBy],
    references: [users.id],
  }),
  items: many(promotionalSchemeItems),
}));

export const promotionalSchemeItems = pgTable('promotional_scheme_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  schemeId: uuid('scheme_id')
    .notNull()
    .references(() => promotionalSchemes.id, { onDelete: 'cascade' }),
  
  brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'cascade' }),
}, (table) => [
  uniqueIndex('promo_scheme_item_brand_unique_idx')
    .on(table.schemeId, table.brandId)
    .where(sql`${table.brandId} is not null`),
  uniqueIndex('promo_scheme_item_variant_unique_idx')
    .on(table.schemeId, table.productId, table.variantId)
    .where(sql`${table.productId} is not null and ${table.variantId} is not null`),
  uniqueIndex('promo_scheme_item_product_unique_idx')
    .on(table.schemeId, table.productId)
    .where(sql`${table.productId} is not null and ${table.variantId} is null`),
  uniqueIndex('promo_scheme_item_category_unique_idx')
    .on(table.schemeId, table.categoryId)
    .where(sql`${table.categoryId} is not null`),
]);

export const promotionalSchemeItemsRelations = relations(promotionalSchemeItems, ({ one }) => ({
  scheme: one(promotionalSchemes, {
    fields: [promotionalSchemeItems.schemeId],
    references: [promotionalSchemes.id],
  }),
  brand: one(brands, {
    fields: [promotionalSchemeItems.brandId],
    references: [brands.id],
  }),
  product: one(products, {
    fields: [promotionalSchemeItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [promotionalSchemeItems.variantId],
    references: [productVariants.id],
  }),
  category: one(categories, {
    fields: [promotionalSchemeItems.categoryId],
    references: [categories.id],
  }),
}));
