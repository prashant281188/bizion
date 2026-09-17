import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { orgStatusEnum, gstRegistrationTypeEnum } from './enums.js';

/**
 * Organizations table — the root tenant entity in the multi-tenant model.
 * Every resource in the system belongs to an organization via org_id.
 */
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  legalName: varchar('legal_name', { length: 255 }),
  slug: varchar('slug', { length: 100 }).notNull().unique(),

  // GST / Tax Registration
  gstin: varchar('gstin', { length: 15 }),
  gstRegistrationType: gstRegistrationTypeEnum('gst_registration_type'),
  pan: varchar('pan', { length: 10 }),
  tan: varchar('tan', { length: 10 }),
  cin: varchar('cin', { length: 21 }),

  // Address
  addressLine1: text('address_line1'),
  addressLine2: text('address_line2'),
  city: varchar('city', { length: 100 }),
  stateCode: varchar('state_code', { length: 2 }),
  stateName: varchar('state_name', { length: 100 }),
  pincode: varchar('pincode', { length: 6 }),
  country: varchar('country', { length: 100 }).default('India'),

  // Contact
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  website: varchar('website', { length: 255 }),

  // Branding
  logoUrl: text('logo_url'),

  // Defaults
  fyStartMonth: integer('fy_start_month').default(4), // April (Indian FY)
  defaultCurrency: varchar('default_currency', { length: 3 }).default('INR'),

  // Status & Plan
  status: orgStatusEnum('status').default('trial').notNull(),
  plan: varchar('plan', { length: 50 }).default('free'),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),

  // Flexible settings stored as JSON
  settings: jsonb('settings').default({}),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
