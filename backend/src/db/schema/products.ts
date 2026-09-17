import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { organizations } from './organizations.js';
import { categories, brands, taxRates, hsnCodes, unitsOfMeasurement } from './masters.js';
import { users } from './users.js';
import { productStatusEnum, productTypeEnum } from './enums.js';
import { contactCustomPrices } from './contact-prices.js';
import { contacts } from './contacts.js';
import { priceLists } from './price-lists.js';

/**
 * Products table — the core product/service catalog.
 * Supports both goods and services with optional variant management.
 */
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'set null' }),
  taxRateId: uuid('tax_rate_id').references(() => taxRates.id, { onDelete: 'set null' }),
  hsnCodeId: uuid('hsn_code_id').references(() => hsnCodes.id, { onDelete: 'set null' }),

  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  description: text('description'),
  shortDescription: varchar('short_description', { length: 500 }),
  type: productTypeEnum('type').default('goods').notNull(),

  sku: varchar('sku', { length: 100 }),
  barcode: varchar('barcode', { length: 100 }),

  // Pricing — stored as numeric(15,2) for precise monetary values
  valuationCost: numeric('valuation_cost', { precision: 15, scale: 2 }).default('0').notNull(),
  sellingPrice: numeric('selling_price', { precision: 15, scale: 2 }).default('0').notNull(),
  mrp: numeric('mrp', { precision: 15, scale: 2 }).default('0').notNull(),

  uomId: uuid('uom_id').references(() => unitsOfMeasurement.id, { onDelete: 'set null' }),
  boxQuantity: integer('box_quantity').default(1).notNull(),

  preferredSupplierId: uuid('preferred_supplier_id').references(() => contacts.id, { onDelete: 'set null' }),

  hasVariants: boolean('has_variants').default(false).notNull(),
  isTaxable: boolean('is_taxable').default(true).notNull(),
  trackInventory: boolean('track_inventory').default(true).notNull(),

  status: productStatusEnum('status').default('draft').notNull(),

  // SEO metadata
  metaTitle: varchar('meta_title', { length: 255 }),
  metaDescription: varchar('meta_description', { length: 500 }),
  tags: text('tags').array(),
  attributes: jsonb('attributes').default({}).notNull(),

  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  orgIdIdx: index('products_org_id_idx').on(table.orgId),
  categoryIdIdx: index('products_category_id_idx').on(table.categoryId),
  brandIdIdx: index('products_brand_id_idx').on(table.brandId),
  slugIdx: index('products_slug_idx').on(table.slug),
  orgNameBrandCategoryIdx: uniqueIndex('products_org_name_brand_category_unique').on(
    table.orgId,
    table.name,
    table.categoryId,
    table.brandId
  ),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [products.orgId],
    references: [organizations.id],
  }),
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  brand: one(brands, {
    fields: [products.brandId],
    references: [brands.id],
  }),
  taxRate: one(taxRates, {
    fields: [products.taxRateId],
    references: [taxRates.id],
  }),
  hsnCode: one(hsnCodes, {
    fields: [products.hsnCodeId],
    references: [hsnCodes.id],
  }),
  uom: one(unitsOfMeasurement, {
    fields: [products.uomId],
    references: [unitsOfMeasurement.id],
  }),
  creator: one(users, {
    fields: [products.createdBy],
    references: [users.id],
  }),
  variants: many(productVariants),
  images: many(productImages),
  customPrices: many(contactCustomPrices),
  preferredSupplier: one(contacts, {
    fields: [products.preferredSupplierId],
    references: [contacts.id],
  }),
}));

/**
 * Product Variants — size, color, weight variations of a parent product.
 * Each variant has its own SKU, pricing, and stock levels.
 */
export const productVariants = pgTable('product_variants', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),

  sku: varchar('sku', { length: 100 }),
  barcode: varchar('barcode', { length: 100 }),
  name: varchar('name', { length: 255 }).notNull(),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  attributes: jsonb('attributes').default({}).notNull(), // e.g., { "color": "Red", "size": "XL" }

  valuationCost: numeric('valuation_cost', { precision: 15, scale: 2 }).default('0').notNull(),
  sellingPrice: numeric('selling_price', { precision: 15, scale: 2 }).default('0').notNull(),
  mrp: numeric('mrp', { precision: 15, scale: 2 }).default('0').notNull(),
  defaultPacking: varchar('default_packing', { length: 255 }),
  boxQuantity: integer('box_quantity').default(1).notNull(),

  preferredSupplierId: uuid('preferred_supplier_id').references(() => contacts.id, { onDelete: 'set null' }),

  stockQuantity: integer('stock_quantity').default(0).notNull(),
  lowStockThreshold: integer('low_stock_threshold').default(10).notNull(),

  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  orgIdIdx: index('product_variants_org_id_idx').on(table.orgId),
  productIdIdx: index('product_variants_product_id_idx').on(table.productId),
}));

export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [productVariants.orgId],
    references: [organizations.id],
  }),
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
  category: one(categories, {
    fields: [productVariants.categoryId],
    references: [categories.id],
  }),
  preferredSupplier: one(contacts, {
    fields: [productVariants.preferredSupplierId],
    references: [contacts.id],
  }),
  priceHistory: many(productVariantPriceHistory),
  customPrices: many(contactCustomPrices),
  pricingRules: many(productPricingRules),
}));

/**
 * Product Variant Price History — logs price changes for auditing.
 */
export const productVariantPriceHistory = pgTable('product_variant_price_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  productId: uuid('product_id')
    .references(() => products.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id')
    .references(() => productVariants.id, { onDelete: 'cascade' }),
  valuationCost: numeric('valuation_cost', { precision: 15, scale: 2 }).notNull(),
  mrp: numeric('mrp', { precision: 15, scale: 2 }).default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by')
    .references(() => users.id, { onDelete: 'set null' }),
});

export const productVariantPriceHistoryRelations = relations(productVariantPriceHistory, ({ one }) => ({
  organization: one(organizations, {
    fields: [productVariantPriceHistory.orgId],
    references: [organizations.id],
  }),
  product: one(products, {
    fields: [productVariantPriceHistory.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [productVariantPriceHistory.variantId],
    references: [productVariants.id],
  }),
  user: one(users, {
    fields: [productVariantPriceHistory.createdBy],
    references: [users.id],
  }),
}));

/**
 * Product Images — image gallery for products and their variants.
 */
export const productImages = pgTable('product_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),

  url: text('url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  altText: varchar('alt_text', { length: 255 }),
  sortOrder: integer('sort_order').default(0).notNull(),
  isPrimary: boolean('is_primary').default(false).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdIdx: index('product_images_org_id_idx').on(table.orgId),
  productIdIdx: index('product_images_product_id_idx').on(table.productId),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  organization: one(organizations, {
    fields: [productImages.orgId],
    references: [organizations.id],
  }),
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [productImages.variantId],
    references: [productVariants.id],
  }),
}));

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;
export type ProductImage = typeof productImages.$inferSelect;
export type NewProductImage = typeof productImages.$inferInsert;

/**
 * Product Pricing Rules — defines how pricing is calculated for products/variants.
 */
export const productPricingRules = pgTable('product_pricing_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id')
    .references(() => productVariants.id, { onDelete: 'cascade' }),
  priceListId: uuid('price_list_id')
    .references(() => priceLists.id, { onDelete: 'cascade' }),
  
  // Configuration
  purchaseMode: varchar('purchase_mode', { length: 20 }),
  listPrice: numeric('list_price', { precision: 15, scale: 2 }).default('0'),
  marginPct: numeric('margin_pct', { precision: 5, scale: 2 }).default('0'),
  discountPct: numeric('discount_pct', { precision: 5, scale: 2 }).default('0'),
  salesDiscountPct: numeric('sales_discount_pct', { precision: 5, scale: 2 }).default('0'),
  
  // Effective Dates (For future promotions)
  effectiveFrom: timestamp('effective_from', { withTimezone: true }),
  effectiveTo: timestamp('effective_to', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  // A variant can only have one active pricing rule per price list
  uniqueIndex('product_pricing_rules_variant_price_list_idx')
    .on(table.orgId, table.productId, table.variantId, table.priceListId)
    .where(sql`${table.variantId} is not null`),
  // A product can only have one active pricing rule per price list
  uniqueIndex('product_pricing_rules_product_price_list_idx')
    .on(table.orgId, table.productId, table.priceListId)
    .where(sql`${table.variantId} is null`),
]);

export const productPricingRulesRelations = relations(productPricingRules, ({ one }) => ({
  organization: one(organizations, {
    fields: [productPricingRules.orgId],
    references: [organizations.id],
  }),
  product: one(products, {
    fields: [productPricingRules.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [productPricingRules.variantId],
    references: [productVariants.id],
  }),
  priceList: one(priceLists, {
    fields: [productPricingRules.priceListId],
    references: [priceLists.id],
  }),
}));
