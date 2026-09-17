import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  integer,
  date,
  boolean,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations.js';
import { invoices } from './invoices.js';
import { gstFilingStatusEnum, gstPeriodTypeEnum } from './enums.js';

/**
 * GST Return Periods — tracks filing periods and their status.
 * Supports both monthly and quarterly filing frequencies.
 */
export const gstReturnPeriods = pgTable('gst_return_periods', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),

  returnType: varchar('return_type', { length: 10 }).notNull(), // GSTR1, GSTR3B, etc.
  periodType: gstPeriodTypeEnum('period_type').notNull(),
  financialYear: varchar('financial_year', { length: 7 }).notNull(), // e.g., "2025-26"
  periodMonth: integer('period_month'), // 1-12 for monthly, null for quarterly
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),

  filingStatus: gstFilingStatusEnum('filing_status').default('pending').notNull(),
  filedAt: timestamp('filed_at', { withTimezone: true }),
  arn: varchar('arn', { length: 50 }), // Acknowledgement Reference Number

  summaryData: jsonb('summary_data').default({}),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const gstReturnPeriodsRelations = relations(gstReturnPeriods, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [gstReturnPeriods.orgId],
    references: [organizations.id],
  }),
  gstr1Data: many(gstr1Data),
  gstr3bData: many(gstr3bData),
  hsnSummary: many(hsnSummary),
}));

/**
 * GSTR-1 Data — outward supply details for GSTR-1 filing.
 * Maps each invoice to its appropriate GSTR-1 table (B2B, B2CS, B2CL, etc.).
 */
export const gstr1Data = pgTable('gstr1_data', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  returnPeriodId: uuid('return_period_id')
    .notNull()
    .references(() => gstReturnPeriods.id, { onDelete: 'cascade' }),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'restrict' }),

  gstr1Table: varchar('gstr1_table', { length: 10 }).notNull(), // B2B, B2CL, B2CS, CDNR, CDNUR, EXP, etc.
  recipientGstin: varchar('recipient_gstin', { length: 15 }),
  recipientName: varchar('recipient_name', { length: 255 }),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
  invoiceDate: date('invoice_date').notNull(),
  invoiceValue: numeric('invoice_value', { precision: 15, scale: 2 }).notNull(),
  placeOfSupply: varchar('place_of_supply', { length: 2 }),
  reverseCharge: boolean('reverse_charge').default(false).notNull(),

  taxableValue: numeric('taxable_value', { precision: 15, scale: 2 }).notNull(),
  igstAmount: numeric('igst_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  cgstAmount: numeric('cgst_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  sgstAmount: numeric('sgst_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  cessAmount: numeric('cess_amount', { precision: 15, scale: 2 }).default('0').notNull(),

  status: varchar('status', { length: 20 }).default('pending').notNull(),
  errorDetails: jsonb('error_details'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const gstr1DataRelations = relations(gstr1Data, ({ one }) => ({
  organization: one(organizations, {
    fields: [gstr1Data.orgId],
    references: [organizations.id],
  }),
  returnPeriod: one(gstReturnPeriods, {
    fields: [gstr1Data.returnPeriodId],
    references: [gstReturnPeriods.id],
  }),
  invoice: one(invoices, {
    fields: [gstr1Data.invoiceId],
    references: [invoices.id],
  }),
}));

/**
 * GSTR-3B Data — monthly summary return with outward supplies, ITC, and tax payable.
 * Stores aggregated values for each return period.
 */
export const gstr3bData = pgTable('gstr3b_data', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  returnPeriodId: uuid('return_period_id')
    .notNull()
    .references(() => gstReturnPeriods.id, { onDelete: 'cascade' }),

  // 3.1 — Outward supplies
  osNonGstOutward: numeric('os_non_gst_outward', { precision: 15, scale: 2 }).default('0').notNull(),
  osOutwardTaxable: numeric('os_outward_taxable', { precision: 15, scale: 2 }).default('0').notNull(),
  osOutwardIgst: numeric('os_outward_igst', { precision: 15, scale: 2 }).default('0').notNull(),
  osOutwardCgst: numeric('os_outward_cgst', { precision: 15, scale: 2 }).default('0').notNull(),
  osOutwardSgst: numeric('os_outward_sgst', { precision: 15, scale: 2 }).default('0').notNull(),
  osOutwardCess: numeric('os_outward_cess', { precision: 15, scale: 2 }).default('0').notNull(),

  // 4 — ITC (Input Tax Credit)
  itcIgst: numeric('itc_igst', { precision: 15, scale: 2 }).default('0').notNull(),
  itcCgst: numeric('itc_cgst', { precision: 15, scale: 2 }).default('0').notNull(),
  itcSgst: numeric('itc_sgst', { precision: 15, scale: 2 }).default('0').notNull(),
  itcCess: numeric('itc_cess', { precision: 15, scale: 2 }).default('0').notNull(),

  // 6.1 — Tax payable
  tpIgst: numeric('tp_igst', { precision: 15, scale: 2 }).default('0').notNull(),
  tpCgst: numeric('tp_cgst', { precision: 15, scale: 2 }).default('0').notNull(),
  tpSgst: numeric('tp_sgst', { precision: 15, scale: 2 }).default('0').notNull(),
  tpCess: numeric('tp_cess', { precision: 15, scale: 2 }).default('0').notNull(),

  interestPayable: numeric('interest_payable', { precision: 15, scale: 2 }).default('0').notNull(),
  lateFee: numeric('late_fee', { precision: 15, scale: 2 }).default('0').notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const gstr3bDataRelations = relations(gstr3bData, ({ one }) => ({
  organization: one(organizations, {
    fields: [gstr3bData.orgId],
    references: [organizations.id],
  }),
  returnPeriod: one(gstReturnPeriods, {
    fields: [gstr3bData.returnPeriodId],
    references: [gstReturnPeriods.id],
  }),
}));

/**
 * HSN Summary — HSN/SAC wise summary for GST returns.
 * Aggregates quantity and tax values by HSN code for a filing period.
 */
export const hsnSummary = pgTable('hsn_summary', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  returnPeriodId: uuid('return_period_id')
    .notNull()
    .references(() => gstReturnPeriods.id, { onDelete: 'cascade' }),

  hsnCode: varchar('hsn_code', { length: 8 }).notNull(),
  description: text('description'),
  uqcCode: varchar('uqc_code', { length: 10 }),
  totalQuantity: numeric('total_quantity', { precision: 15, scale: 3 }).default('0').notNull(),
  totalTaxableValue: numeric('total_taxable_value', { precision: 15, scale: 2 }).default('0').notNull(),
  igstAmount: numeric('igst_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  cgstAmount: numeric('cgst_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  sgstAmount: numeric('sgst_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  cessAmount: numeric('cess_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  totalValue: numeric('total_value', { precision: 15, scale: 2 }).default('0').notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const hsnSummaryRelations = relations(hsnSummary, ({ one }) => ({
  organization: one(organizations, {
    fields: [hsnSummary.orgId],
    references: [organizations.id],
  }),
  returnPeriod: one(gstReturnPeriods, {
    fields: [hsnSummary.returnPeriodId],
    references: [gstReturnPeriods.id],
  }),
}));

export type GstReturnPeriod = typeof gstReturnPeriods.$inferSelect;
export type NewGstReturnPeriod = typeof gstReturnPeriods.$inferInsert;
export type Gstr1Data = typeof gstr1Data.$inferSelect;
export type NewGstr1Data = typeof gstr1Data.$inferInsert;
export type Gstr3bData = typeof gstr3bData.$inferSelect;
export type NewGstr3bData = typeof gstr3bData.$inferInsert;
export type HsnSummary = typeof hsnSummary.$inferSelect;
export type NewHsnSummary = typeof hsnSummary.$inferInsert;
