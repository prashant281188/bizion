import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  boolean,
  date,
  timestamp,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations.js';
import { contacts } from './contacts.js';
import { taxRates } from './masters.js';
import { users } from './users.js';
import {
  accountTypeEnum,
  journalEntryStatusEnum,
  entryTypeEnum,
} from './enums.js';

/**
 * Chart of Accounts — the accounting ledger structure.
 * Supports hierarchical accounts with parent-child relationships.
 * System accounts cannot be deleted or modified by users.
 */
export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),

  code: varchar('code', { length: 20 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  type: accountTypeEnum('type').notNull(),
  parentId: uuid('parent_id'),
  description: text('description'),

  isSystem: boolean('is_system').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),

  taxRateId: uuid('tax_rate_id').references(() => taxRates.id, { onDelete: 'set null' }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const accountsRelations = relations(accounts, ({ one }) => ({
  organization: one(organizations, {
    fields: [accounts.orgId],
    references: [organizations.id],
  }),
  parent: one(accounts, {
    fields: [accounts.parentId],
    references: [accounts.id],
  }),
  taxRate: one(taxRates, {
    fields: [accounts.taxRateId],
    references: [taxRates.id],
  }),
}));

/**
 * Financial Transactions — the header/container for journal entries.
 * Each transaction groups related debit/credit entries that must balance.
 * Links back to the source document (invoice, payment, etc.).
 */
export const financialTransactions = pgTable('financial_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),

  transactionNumber: varchar('transaction_number', { length: 50 }).notNull(),
  transactionDate: date('transaction_date').notNull(),
  description: text('description'),

  // Source document reference
  sourceType: varchar('source_type', { length: 50 }), // e.g., 'invoice', 'payment', 'manual'
  sourceId: uuid('source_id'),

  status: journalEntryStatusEnum('status').default('draft').notNull(),

  // Reversal tracking
  reversedBy: uuid('reversed_by'),
  reversalOf: uuid('reversal_of'),

  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  postedAt: timestamp('posted_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const financialTransactionsRelations = relations(financialTransactions, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [financialTransactions.orgId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [financialTransactions.createdBy],
    references: [users.id],
  }),
  journalEntries: many(journalEntries),
}));

/**
 * Journal Entries — individual debit/credit entries within a financial transaction.
 * Every financial event produces balanced debit and credit entries.
 * This is the double-entry bookkeeping core.
 */
export const journalEntries = pgTable('journal_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  transactionId: uuid('transaction_id')
    .notNull()
    .references(() => financialTransactions.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'restrict' }),

  entryType: entryTypeEnum('entry_type').notNull(),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  description: text('description'),

  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const journalEntriesRelations = relations(journalEntries, ({ one }) => ({
  organization: one(organizations, {
    fields: [journalEntries.orgId],
    references: [organizations.id],
  }),
  transaction: one(financialTransactions, {
    fields: [journalEntries.transactionId],
    references: [financialTransactions.id],
  }),
  account: one(accounts, {
    fields: [journalEntries.accountId],
    references: [accounts.id],
  }),
  contact: one(contacts, {
    fields: [journalEntries.contactId],
    references: [contacts.id],
  }),
}));

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type FinancialTransaction = typeof financialTransactions.$inferSelect;
export type NewFinancialTransaction = typeof financialTransactions.$inferInsert;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type NewJournalEntry = typeof journalEntries.$inferInsert;
