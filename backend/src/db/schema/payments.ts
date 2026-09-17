import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  date,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations.js';
import { contacts } from './contacts.js';
import { invoices } from './invoices.js';
import { users } from './users.js';
import {
  paymentModeEnum,
  paymentStatusEnum,
  paymentDirectionEnum,
} from './enums.js';

/**
 * Bank Accounts — organization's bank/UPI accounts for payment tracking.
 * Links to the accounting ledger for automatic journal entries.
 */
export const bankAccounts = pgTable('bank_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),

  accountName: varchar('account_name', { length: 255 }).notNull(),
  bankName: varchar('bank_name', { length: 255 }),
  accountNumber: varchar('account_number', { length: 50 }),
  ifscCode: varchar('ifsc_code', { length: 11 }),
  branch: varchar('branch', { length: 255 }),
  accountType: varchar('account_type', { length: 50 }),
  upiId: varchar('upi_id', { length: 100 }),

  openingBalance: numeric('opening_balance', { precision: 15, scale: 2 }).default('0').notNull(),
  currentBalance: numeric('current_balance', { precision: 15, scale: 2 }).default('0').notNull(),

  isDefault: boolean('is_default').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),

  // Link to chart of accounts
  ledgerAccountId: uuid('ledger_account_id'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const bankAccountsRelations = relations(bankAccounts, ({ one }) => ({
  organization: one(organizations, {
    fields: [bankAccounts.orgId],
    references: [organizations.id],
  }),
}));

/**
 * Payments — money received from customers (inbound) or paid to vendors (outbound).
 * Payments can be partially or fully allocated to invoices.
 */
export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),

  paymentNumber: varchar('payment_number', { length: 50 }).notNull(),
  paymentDate: date('payment_date').notNull(),
  direction: paymentDirectionEnum('direction').notNull(),

  contactId: uuid('contact_id')
    .notNull()
    .references(() => contacts.id, { onDelete: 'restrict' }),

  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  unusedAmount: numeric('unused_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  currency: varchar('currency', { length: 3 }).default('INR').notNull(),
  exchangeRate: numeric('exchange_rate', { precision: 10, scale: 4 }).default('1.0000').notNull(),

  paymentMode: paymentModeEnum('payment_mode').notNull(),
  bankAccountId: uuid('bank_account_id').references(() => bankAccounts.id, { onDelete: 'set null' }),
  transactionRef: varchar('transaction_ref', { length: 255 }),
  chequeDate: date('cheque_date'),

  status: paymentStatusEnum('status').default('pending').notNull(),
  notes: text('notes'),

  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [payments.orgId],
    references: [organizations.id],
  }),
  contact: one(contacts, {
    fields: [payments.contactId],
    references: [contacts.id],
  }),
  bankAccount: one(bankAccounts, {
    fields: [payments.bankAccountId],
    references: [bankAccounts.id],
  }),
  creator: one(users, {
    fields: [payments.createdBy],
    references: [users.id],
  }),
  allocations: many(paymentAllocations),
}));

/**
 * Payment Allocations — links payments to specific invoices.
 * Enables partial payments across multiple invoices and excess payment tracking.
 */
export const paymentAllocations = pgTable('payment_allocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  paymentId: uuid('payment_id')
    .notNull()
    .references(() => payments.id, { onDelete: 'cascade' }),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'restrict' }),

  amountApplied: numeric('amount_applied', { precision: 15, scale: 2 }).notNull(),
  appliedDate: date('applied_date').notNull(),
  notes: text('notes'),

  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const paymentAllocationsRelations = relations(paymentAllocations, ({ one }) => ({
  organization: one(organizations, {
    fields: [paymentAllocations.orgId],
    references: [organizations.id],
  }),
  payment: one(payments, {
    fields: [paymentAllocations.paymentId],
    references: [payments.id],
  }),
  invoice: one(invoices, {
    fields: [paymentAllocations.invoiceId],
    references: [invoices.id],
  }),
  creator: one(users, {
    fields: [paymentAllocations.createdBy],
    references: [users.id],
  }),
}));

/**
 * Credit Note Allocations — links a credit note to an invoice.
 * When a credit note is applied to an invoice, both balances reduce.
 * This is separate from cash payment allocations.
 */
export const creditNoteAllocations = pgTable('credit_note_allocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),

  // The credit note being applied (must be document_type = 'credit_note')
  creditNoteId: uuid('credit_note_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'restrict' }),

  // The invoice being reduced
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'restrict' }),

  amountApplied: numeric('amount_applied', { precision: 15, scale: 2 }).notNull(),
  appliedDate: date('applied_date').notNull(),
  notes: text('notes'),

  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const creditNoteAllocationsRelations = relations(creditNoteAllocations, ({ one }) => ({
  organization: one(organizations, {
    fields: [creditNoteAllocations.orgId],
    references: [organizations.id],
  }),
  creditNote: one(invoices, {
    fields: [creditNoteAllocations.creditNoteId],
    references: [invoices.id],
    relationName: 'creditNoteSource',
  }),
  invoice: one(invoices, {
    fields: [creditNoteAllocations.invoiceId],
    references: [invoices.id],
    relationName: 'creditNoteTarget',
  }),
  creator: one(users, {
    fields: [creditNoteAllocations.createdBy],
    references: [users.id],
  }),
}));

export type BankAccount = typeof bankAccounts.$inferSelect;
export type NewBankAccount = typeof bankAccounts.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type PaymentAllocation = typeof paymentAllocations.$inferSelect;
export type NewPaymentAllocation = typeof paymentAllocations.$inferInsert;
export type CreditNoteAllocation = typeof creditNoteAllocations.$inferSelect;
export type NewCreditNoteAllocation = typeof creditNoteAllocations.$inferInsert;
