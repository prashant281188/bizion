import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations.js';
import { users } from './users.js';

/**
 * Audit Logs — immutable record of all data mutations.
 * Tracks who changed what, when, and stores before/after snapshots.
 * Critical for compliance, debugging, and security monitoring.
 */
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),

  entityType: varchar('entity_type', { length: 100 }).notNull(), // e.g., 'invoice', 'contact', 'product'
  entityId: uuid('entity_id').notNull(),
  action: varchar('action', { length: 20 }).notNull(), // 'create', 'update', 'delete'

  oldValues: jsonb('old_values'),
  newValues: jsonb('new_values'),

  ipAddress: varchar('ip_address', { length: 45 }), // IPv6 max length
  userAgent: text('user_agent'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditLogs.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
