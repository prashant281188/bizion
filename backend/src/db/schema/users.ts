import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations.js';
import { contacts } from './contacts.js';
import { userRoleEnum, userStatusEnum } from './enums.js';

/**
 * Users table — organization members with role-based access.
 * A user always belongs to one organization (multi-tenancy via org_id).
 * The (org_id, email) pair is unique — same email can exist across orgs.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id').references((): any => contacts.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }),
    phone: varchar('phone', { length: 20 }),
    avatarUrl: text('avatar_url'),
    role: userRoleEnum('role').default('agent').notNull(),
    status: userStatusEnum('status').default('invited').notNull(),
    permissions: text('permissions').array().default([]).notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    inviteToken: varchar('invite_token', { length: 255 }),
    inviteExpiresAt: timestamp('invite_expires_at', { withTimezone: true }),
    resetToken: varchar('reset_token', { length: 255 }),
    resetExpiresAt: timestamp('reset_expires_at', { withTimezone: true }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    unique('users_org_email_unique').on(table.orgId, table.email),
  ]
);

export const usersRelations = relations(users, ({ one }) => ({
  organization: one(organizations, {
    fields: [users.orgId],
    references: [organizations.id],
  }),
  contact: one(contacts, {
    fields: [users.contactId],
    references: [contacts.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
