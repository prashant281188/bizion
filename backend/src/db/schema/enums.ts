import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * PostgreSQL enum definitions for the Bizion platform.
 * Each enum maps to a PostgreSQL ENUM type and is referenced by table columns.
 */

// ─── Organization ────────────────────────────────────────────────────────────

export const orgStatusEnum = pgEnum('org_status', [
  'active',
  'suspended',
  'cancelled',
  'trial',
]);

// ─── Users ───────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', [
  'owner',
  'admin',
  'manager',
  'agent',
  'accountant',
  'viewer',
  'customer',
]);

export const userStatusEnum = pgEnum('user_status', [
  'active',
  'inactive',
  'invited',
  'suspended',
]);

// ─── GST ─────────────────────────────────────────────────────────────────────

export const gstRegistrationTypeEnum = pgEnum('gst_registration_type', [
  'regular',
  'composition',
  'unregistered',
  'consumer',
  'sez',
  'deemed_export',
]);

// ─── Products ────────────────────────────────────────────────────────────────

export const productStatusEnum = pgEnum('product_status', [
  'active',
  'inactive',
  'draft',
  'archived',
]);

export const productTypeEnum = pgEnum('product_type', [
  'goods',
  'services',
]);

// ─── Documents & Invoices ────────────────────────────────────────────────────

export const documentTypeEnum = pgEnum('document_type', [
  'sales_invoice',
  'purchase_invoice',
  'credit_note',
  'debit_note',
  'proforma',
  'quotation',
  'delivery_challan',
  'purchase_order',
  'sales_order',
]);

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'draft',
  'approved',
  'sent',
  'partially_paid',
  'paid',
  'overdue',
  'cancelled',
  'void',
]);

export const supplyTypeEnum = pgEnum('supply_type', [
  'b2b',
  'b2c_large',
  'b2c_small',
  'sez_with_payment',
  'sez_without_payment',
  'deemed_export',
  'export_with_payment',
  'export_without_payment',
]);

export const discountTypeEnum = pgEnum('discount_type', [
  'percentage',
  'fixed',
]);

export const einvoiceStatusEnum = pgEnum('einvoice_status', [
  'not_applicable',
  'pending',
  'generated',
  'cancelled',
  'failed',
]);

// ─── Payments ────────────────────────────────────────────────────────────────

export const paymentModeEnum = pgEnum('payment_mode', [
  'cash',
  'bank_transfer',
  'upi',
  'cheque',
  'credit_card',
  'debit_card',
  'neft',
  'rtgs',
  'imps',
  'demand_draft',
  'online',
  'other',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'presented',
  'completed',
  'failed',
  'bounced',
  'refunded',
  'partially_refunded',
  'cancelled',
]);

export const paymentDirectionEnum = pgEnum('payment_direction', [
  'inbound',
  'outbound',
]);

// ─── Accounting ──────────────────────────────────────────────────────────────

export const accountTypeEnum = pgEnum('account_type', [
  'asset',
  'liability',
  'equity',
  'revenue',
  'expense',
]);

export const journalEntryStatusEnum = pgEnum('journal_entry_status', [
  'draft',
  'posted',
  'reversed',
]);

export const entryTypeEnum = pgEnum('entry_type', [
  'debit',
  'credit',
]);

// ─── GST Filing ──────────────────────────────────────────────────────────────

export const gstFilingStatusEnum = pgEnum('gst_filing_status', [
  'pending',
  'filed',
  'amended',
  'cancelled',
]);

export const gstPeriodTypeEnum = pgEnum('gst_period_type', [
  'monthly',
  'quarterly',
]);

// ─── Contacts ────────────────────────────────────────────────────────────────

export const contactTypeEnum = pgEnum('contact_type', [
  'customer',
  'vendor',
  'both',
]);
