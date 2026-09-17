import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  boolean,
  timestamp,
  index
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations.js';
import { paymentTerms, taxRates, contactGroups } from './masters.js';
import { users } from './users.js';
import { contactTypeEnum, gstRegistrationTypeEnum } from './enums.js';
import { contactCustomPrices } from './contact-prices.js';
import { priceLists } from './price-lists.js';


/**
 * Contacts — customers, vendors, or both.
 * Central directory for all business relationships in the organization.
 */
export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),

  type: contactTypeEnum('type').default('customer').notNull(),
  companyName: varchar('company_name', { length: 255 }),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  contactPerson: varchar('contact_person', { length: 255 }),

  // GST details
  gstin: varchar('gstin', { length: 15 }),
  gstRegistrationType: gstRegistrationTypeEnum('gst_registration_type'),
  pan: varchar('pan', { length: 10 }),

  // Contact info
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  mobile: varchar('mobile', { length: 20 }),
  website: varchar('website', { length: 255 }),

  // Defaults & financial
  paymentTermId: uuid('payment_term_id').references(() => paymentTerms.id, { onDelete: 'set null' }),
  defaultTaxRateId: uuid('default_tax_rate_id').references(() => taxRates.id, { onDelete: 'set null' }),
  salesPriceListId: uuid('sales_price_list_id').references((): any => priceLists.id, { onDelete: 'set null' }),
  purchasePriceListId: uuid('purchase_price_list_id').references((): any => priceLists.id, { onDelete: 'set null' }),
  creditLimit: numeric('credit_limit', { precision: 15, scale: 2 }).default('0').notNull(),
  openingBalance: numeric('opening_balance', { precision: 15, scale: 2 }).default('0').notNull(),

  // Organization & Scheduling
  contactGroupId: uuid('contact_group_id').references(() => contactGroups.id, { onDelete: 'set null' }),
  contactGroup: varchar('contact_group', { length: 100 }),
  weeklyOff: varchar('weekly_off', { length: 20 }),
  visitFrequency: varchar('visit_frequency', { length: 20 }).default('monthly'),
  preferredVisitWeek: varchar('preferred_visit_week', { length: 20 }).default('any'),
  preferredTransporterId: varchar('preferred_transporter_id', { length: 255 }),
  tags: text('tags').array(),
  notes: text('notes'),
  isActive: boolean('is_active').default(true).notNull(),

  createdBy: uuid('created_by').references((): any => users.id, { onDelete: 'set null' }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  orgIdIdx: index('contacts_org_id_idx').on(table.orgId),
  emailIdx: index('contacts_email_idx').on(table.email),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [contacts.orgId],
    references: [organizations.id],
  }),
  paymentTerm: one(paymentTerms, {
    fields: [contacts.paymentTermId],
    references: [paymentTerms.id],
  }),
  defaultTaxRate: one(taxRates, {
    fields: [contacts.defaultTaxRateId],
    references: [taxRates.id],
  }),
  contactGroupRel: one(contactGroups, {
    fields: [contacts.contactGroupId],
    references: [contactGroups.id],
  }),
  salesPriceList: one(priceLists, {
    fields: [contacts.salesPriceListId],
    references: [priceLists.id],
  }),
  purchasePriceList: one(priceLists, {
    fields: [contacts.purchasePriceListId],
    references: [priceLists.id],
  }),
  creator: one(users, {
    fields: [contacts.createdBy],
    references: [users.id],
  }),
  addresses: many(contactAddresses),
  customPrices: many(contactCustomPrices),
  portalUsers: many(users),
}));


/**
 * Contact Addresses — billing and shipping addresses for contacts.
 * A contact can have multiple addresses with designated defaults for billing/shipping.
 */
export const contactAddresses = pgTable('contact_addresses', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id')
    .notNull()
    .references(() => contacts.id, { onDelete: 'cascade' }),

  label: varchar('label', { length: 100 }).default('Main'),
  addressLine1: text('address_line1').notNull(),
  addressLine2: text('address_line2'),
  city: varchar('city', { length: 100 }).notNull(),
  stateCode: varchar('state_code', { length: 2 }).notNull(),
  stateName: varchar('state_name', { length: 100 }).notNull(),
  pincode: varchar('pincode', { length: 6 }),
  country: varchar('country', { length: 100 }).default('India').notNull(),

  isBillingDefault: boolean('is_billing_default').default(false).notNull(),
  isShippingDefault: boolean('is_shipping_default').default(false).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const contactAddressesRelations = relations(contactAddresses, ({ one }) => ({
  organization: one(organizations, {
    fields: [contactAddresses.orgId],
    references: [organizations.id],
  }),
  contact: one(contacts, {
    fields: [contactAddresses.contactId],
    references: [contacts.id],
  }),
}));

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type ContactAddress = typeof contactAddresses.$inferSelect;
export type NewContactAddress = typeof contactAddresses.$inferInsert;
