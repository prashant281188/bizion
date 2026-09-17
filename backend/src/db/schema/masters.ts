import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  integer,
  boolean,
  timestamp,
  date,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations.js';
import { productTypeEnum } from './enums.js';

/**
 * Units of Measurement — used for products and invoice line items.
 * UQC codes align with GST e-invoicing standards.
 */
export const unitsOfMeasurement = pgTable('units_of_measurement', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 10 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  uqcCode: varchar('uqc_code', { length: 10 }),
  isDefault: boolean('is_default').default(false).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const unitsOfMeasurementRelations = relations(unitsOfMeasurement, ({ one }) => ({
  organization: one(organizations, {
    fields: [unitsOfMeasurement.orgId],
    references: [organizations.id],
  }),
}));

/**
 * Tax Rates — predefined GST rate configurations.
 * Stores the split between CGST, SGST, IGST, and cess for each rate.
 */
export const taxRates = pgTable('tax_rates', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  ratePercentage: numeric('rate_percentage', { precision: 5, scale: 2 }).notNull(),
  cgstRate: numeric('cgst_rate', { precision: 5, scale: 2 }).notNull(),
  sgstRate: numeric('sgst_rate', { precision: 5, scale: 2 }).notNull(),
  igstRate: numeric('igst_rate', { precision: 5, scale: 2 }).notNull(),
  cessRate: numeric('cess_rate', { precision: 5, scale: 2 }).default('0').notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const taxRatesRelations = relations(taxRates, ({ one }) => ({
  organization: one(organizations, {
    fields: [taxRates.orgId],
    references: [organizations.id],
  }),
}));

/**
 * HSN Codes — org-scoped HSN/SAC code registry.
 * Harmonized System of Nomenclature codes for goods and SAC codes for services.
 * Used for GST classification and e-invoicing compliance.
 */
export const hsnCodes = pgTable('hsn_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 8 }).notNull(),
  description: text('description').notNull(),
  type: productTypeEnum('type').notNull(),
  taxRateId: uuid('tax_rate_id')
    .notNull()
    .references(() => taxRates.id, { onDelete: 'restrict' }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const hsnCodesRelations = relations(hsnCodes, ({ one }) => ({
  organization: one(organizations, {
    fields: [hsnCodes.orgId],
    references: [organizations.id],
  }),
  taxRate: one(taxRates, {
    fields: [hsnCodes.taxRateId],
    references: [taxRates.id],
  }),
}));

/**
 * HSN Rate History — tracks every GST rate change for an HSN code.
 * When government revises rates, the change is logged here with effective date and reason.
 */
export const hsnRateHistory = pgTable('hsn_rate_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  hsnCodeId: uuid('hsn_code_id')
    .notNull()
    .references(() => hsnCodes.id, { onDelete: 'cascade' }),
  previousRate: numeric('previous_rate', { precision: 5, scale: 2 }),
  newRate: numeric('new_rate', { precision: 5, scale: 2 }).notNull(),
  effectiveFrom: date('effective_from').notNull(),
  reason: text('reason'),
  changedBy: uuid('changed_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const hsnRateHistoryRelations = relations(hsnRateHistory, ({ one }) => ({
  organization: one(organizations, {
    fields: [hsnRateHistory.orgId],
    references: [organizations.id],
  }),
  hsnCode: one(hsnCodes, {
    fields: [hsnRateHistory.hsnCodeId],
    references: [hsnCodes.id],
  }),
}));

/**
 * Payment Terms — configurable due date rules for invoices.
 */
export const paymentTerms = pgTable('payment_terms', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  dueDays: integer('due_days').notNull(),
  isDefault: boolean('is_default').default(false).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const paymentTermsRelations = relations(paymentTerms, ({ one }) => ({
  organization: one(organizations, {
    fields: [paymentTerms.orgId],
    references: [organizations.id],
  }),
}));

/**
 * Categories — hierarchical product categorization with self-referencing parent.
 */
export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id'),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const categoriesRelations = relations(categories, ({ one }) => ({
  organization: one(organizations, {
    fields: [categories.orgId],
    references: [organizations.id],
  }),
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
  }),
}));

/**
 * Brands — product brand management.
 */
export const brands = pgTable('brands', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  logoUrl: text('logo_url'),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const brandsRelations = relations(brands, ({ one }) => ({
  organization: one(organizations, {
    fields: [brands.orgId],
    references: [organizations.id],
  }),
}));

/**
 * Contact Groups — categories for customers and suppliers.
 */
export const contactGroups = pgTable('contact_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const contactGroupsRelations = relations(contactGroups, ({ one }) => ({
  organization: one(organizations, {
    fields: [contactGroups.orgId],
    references: [organizations.id],
  }),
}));

/**
 * Transporters — logistics agencies & freight partners.
 */
export const transporters = pgTable('transporters', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }),
  transporterId: varchar('transporter_id', { length: 50 }),
  gstin: varchar('gstin', { length: 20 }),
  phone: varchar('phone', { length: 30 }),
  email: varchar('email', { length: 255 }),
  vehicleNumber: varchar('vehicle_number', { length: 50 }),
  remarks: text('remarks'),
  isActive: boolean('is_active').default(true).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const transportersRelations = relations(transporters, ({ one }) => ({
  organization: one(organizations, {
    fields: [transporters.orgId],
    references: [organizations.id],
  }),
}));

export type UnitOfMeasurement = typeof unitsOfMeasurement.$inferSelect;
export type NewUnitOfMeasurement = typeof unitsOfMeasurement.$inferInsert;
export type TaxRate = typeof taxRates.$inferSelect;
export type NewTaxRate = typeof taxRates.$inferInsert;
export type HsnCode = typeof hsnCodes.$inferSelect;
export type NewHsnCode = typeof hsnCodes.$inferInsert;
export type HsnRateHistory = typeof hsnRateHistory.$inferSelect;
export type NewHsnRateHistory = typeof hsnRateHistory.$inferInsert;
export type PaymentTerm = typeof paymentTerms.$inferSelect;
export type NewPaymentTerm = typeof paymentTerms.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;
export type ContactGroup = typeof contactGroups.$inferSelect;
export type NewContactGroup = typeof contactGroups.$inferInsert;
export type TransporterMaster = typeof transporters.$inferSelect;
export type NewTransporterMaster = typeof transporters.$inferInsert;

