import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  integer,
  boolean,
  date,
  timestamp,
  jsonb,
  index
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations.js';
import { contacts, contactAddresses } from './contacts.js';
import { products, productVariants } from './products.js';
import { taxRates, unitsOfMeasurement, paymentTerms, transporters } from './masters.js';
import { users } from './users.js';
import { orders } from './orders.js';
import {
  documentTypeEnum,
  invoiceStatusEnum,
  supplyTypeEnum,
  discountTypeEnum,
  einvoiceStatusEnum,
} from './enums.js';

/**
 * Invoices — the central document table supporting multiple document types.
 * Handles sales invoices, purchase invoices, credit/debit notes, proformas,
 * quotations, delivery challans, and purchase/sales orders.
 *
 * GST-compliant with e-invoicing fields (IRN, QR code, acknowledgement).
 */
export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),

  documentType: documentTypeEnum('document_type').notNull(),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
  invoiceDate: date('invoice_date').notNull(),
  dueDate: date('due_date'),

  // Reference to original document (for credit/debit notes)
  referenceInvoiceId: uuid('reference_invoice_id'),
  referenceNumber: varchar('reference_number', { length: 100 }),

  // Contact & addresses
  contactId: uuid('contact_id')
    .notNull()
    .references(() => contacts.id, { onDelete: 'restrict' }),
  billingAddressId: uuid('billing_address_id').references(() => contactAddresses.id, { onDelete: 'set null' }),
  shippingAddressId: uuid('shipping_address_id').references(() => contactAddresses.id, { onDelete: 'set null' }),

  // GST supply classification
  supplyType: supplyTypeEnum('supply_type').default('b2b'),
  placeOfSupplyCode: varchar('place_of_supply_code', { length: 2 }),
  isInterState: boolean('is_inter_state').default(false).notNull(),
  reverseCharge: boolean('reverse_charge').default(false).notNull(),

  // E-invoicing fields (IRN system)
  irn: varchar('irn', { length: 64 }),
  irnDate: timestamp('irn_date', { withTimezone: true }),
  ackNumber: varchar('ack_number', { length: 50 }),
  ackDate: timestamp('ack_date', { withTimezone: true }),
  signedQrCode: text('signed_qr_code'),
  einvoiceStatus: einvoiceStatusEnum('einvoice_status').default('not_applicable').notNull(),

  // Financial summary — all monetary fields use numeric(15,2)
  subtotal: numeric('subtotal', { precision: 15, scale: 2 }).default('0').notNull(),
  discountAmount: numeric('discount_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  taxableAmount: numeric('taxable_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  cgstAmount: numeric('cgst_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  sgstAmount: numeric('sgst_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  igstAmount: numeric('igst_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  cessAmount: numeric('cess_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  totalTaxAmount: numeric('total_tax_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  shippingCharge: numeric('shipping_charge', { precision: 15, scale: 2 }).default('0').notNull(),
  roundOff: numeric('round_off', { precision: 15, scale: 2 }).default('0').notNull(),
  totalAmount: numeric('total_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  amountPaid: numeric('amount_paid', { precision: 15, scale: 2 }).default('0').notNull(),
  balanceDue: numeric('balance_due', { precision: 15, scale: 2 }).default('0').notNull(),

  // Currency
  currency: varchar('currency', { length: 3 }).default('INR').notNull(),
  exchangeRate: numeric('exchange_rate', { precision: 10, scale: 4 }).default('1.0000').notNull(),

  paymentTermId: uuid('payment_term_id').references(() => paymentTerms.id, { onDelete: 'set null' }),

  // Status & workflow
  status: invoiceStatusEnum('status').default('draft').notNull(),

  // Notes & Custom Data
  notes: text('notes'),
  termsAndConditions: text('terms_and_conditions'),
  customerNotes: text('customer_notes'),
  customFields: jsonb('custom_fields').default({}),

  // E-way bill & Logistics
  transporterId: uuid('transporter_id').references(() => transporters.id, { onDelete: 'set null' }),
  ewayBillNumber: varchar('eway_bill_number', { length: 20 }),
  ewayBillDate: date('eway_bill_date'),
  transportMode: varchar('transport_mode', { length: 20 }),
  vehicleNumber: varchar('vehicle_number', { length: 20 }),

  // Approval
  approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),

  // Link purchase invoices back to the originating Purchase Order
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  orgIdIdx: index('invoices_org_id_idx').on(table.orgId),
  contactIdIdx: index('invoices_contact_id_idx').on(table.contactId),
  invoiceNumberIdx: index('invoices_invoice_number_idx').on(table.invoiceNumber),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [invoices.orgId],
    references: [organizations.id],
  }),
  contact: one(contacts, {
    fields: [invoices.contactId],
    references: [contacts.id],
  }),
  transporter: one(transporters, {
    fields: [invoices.transporterId],
    references: [transporters.id],
  }),
  billingAddress: one(contactAddresses, {
    fields: [invoices.billingAddressId],
    references: [contactAddresses.id],
    relationName: 'billingAddress',
  }),
  shippingAddress: one(contactAddresses, {
    fields: [invoices.shippingAddressId],
    references: [contactAddresses.id],
    relationName: 'shippingAddress',
  }),
  referenceInvoice: one(invoices, {
    fields: [invoices.referenceInvoiceId],
    references: [invoices.id],
    relationName: 'referenceInvoice',
  }),
  paymentTerm: one(paymentTerms, {
    fields: [invoices.paymentTermId],
    references: [paymentTerms.id],
  }),
  approver: one(users, {
    fields: [invoices.approvedBy],
    references: [users.id],
    relationName: 'approver',
  }),
  creator: one(users, {
    fields: [invoices.createdBy],
    references: [users.id],
    relationName: 'creator',
  }),
  lineItems: many(invoiceLineItems),
  attachments: many(invoiceAttachments),
}));

/**
 * Invoice Line Items — individual products/services on an invoice.
 * Each line has its own tax calculation for precise GST compliance.
 */
export const invoiceLineItems = pgTable('invoice_line_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),

  lineNumber: integer('line_number').notNull(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
  variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
  hsnCode: varchar('hsn_code', { length: 8 }),
  description: text('description').notNull(),
  uomId: uuid('uom_id').references(() => unitsOfMeasurement.id, { onDelete: 'set null' }),

  quantity: numeric('quantity', { precision: 15, scale: 3 }).notNull(),
  unitPrice: numeric('unit_price', { precision: 15, scale: 2 }).notNull(),

  // Discount
  discountType: discountTypeEnum('discount_type'),
  discountValue: numeric('discount_value', { precision: 15, scale: 2 }).default('0').notNull(),
  discountAmount: numeric('discount_amount', { precision: 15, scale: 2 }).default('0').notNull(),

  // Tax calculation per line
  taxableValue: numeric('taxable_value', { precision: 15, scale: 2 }).notNull(),
  taxRateId: uuid('tax_rate_id').references(() => taxRates.id, { onDelete: 'set null' }),
  taxRatePercent: numeric('tax_rate_percent', { precision: 5, scale: 2 }).default('0').notNull(),
  cgstRate: numeric('cgst_rate', { precision: 5, scale: 2 }).default('0').notNull(),
  cgstAmount: numeric('cgst_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  sgstRate: numeric('sgst_rate', { precision: 5, scale: 2 }).default('0').notNull(),
  sgstAmount: numeric('sgst_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  igstRate: numeric('igst_rate', { precision: 5, scale: 2 }).default('0').notNull(),
  igstAmount: numeric('igst_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  cessRate: numeric('cess_rate', { precision: 5, scale: 2 }).default('0').notNull(),
  cessAmount: numeric('cess_amount', { precision: 15, scale: 2 }).default('0').notNull(),

  totalAmount: numeric('total_amount', { precision: 15, scale: 2 }).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const invoiceLineItemsRelations = relations(invoiceLineItems, ({ one }) => ({
  organization: one(organizations, {
    fields: [invoiceLineItems.orgId],
    references: [organizations.id],
  }),
  invoice: one(invoices, {
    fields: [invoiceLineItems.invoiceId],
    references: [invoices.id],
  }),
  product: one(products, {
    fields: [invoiceLineItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [invoiceLineItems.variantId],
    references: [productVariants.id],
  }),
  taxRate: one(taxRates, {
    fields: [invoiceLineItems.taxRateId],
    references: [taxRates.id],
  }),
  uom: one(unitsOfMeasurement, {
    fields: [invoiceLineItems.uomId],
    references: [unitsOfMeasurement.id],
  }),
}));

/**
 * Invoice Attachments — files associated with invoices (PDFs, images, etc.).
 */
export const invoiceAttachments = pgTable('invoice_attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),

  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileUrl: text('file_url').notNull(),
  fileType: varchar('file_type', { length: 50 }),
  fileSize: integer('file_size'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const invoiceAttachmentsRelations = relations(invoiceAttachments, ({ one }) => ({
  organization: one(organizations, {
    fields: [invoiceAttachments.orgId],
    references: [organizations.id],
  }),
  invoice: one(invoices, {
    fields: [invoiceAttachments.invoiceId],
    references: [invoices.id],
  }),
  creator: one(users, {
    fields: [invoiceAttachments.createdBy],
    references: [users.id],
  }),
}));

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type NewInvoiceLineItem = typeof invoiceLineItems.$inferInsert;
export type InvoiceAttachment = typeof invoiceAttachments.$inferSelect;
export type NewInvoiceAttachment = typeof invoiceAttachments.$inferInsert;
