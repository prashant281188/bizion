import { pgTable, varchar, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';

export const tourPlans = pgTable('tour_plans', {
  id: varchar('id', { length: 255 }).primaryKey(),
  orgId: varchar('org_id', { length: 255 }).notNull().references(() => organizations.id),
  name: varchar('name', { length: 255 }).notNull(),
  month: varchar('month', { length: 50 }).notNull(),
  year: varchar('year', { length: 10 }).notNull(),
  cities: jsonb('cities').$type<string[]>().notNull(),
  plannedVisitIds: jsonb('planned_visit_ids').$type<string[]>().notNull(),
  dateVisits: jsonb('date_visits').$type<{
    id: string;
    date: string;
    contactId: string;
    notes?: string;
    status?: 'scheduled' | 'completed' | 'rescheduled' | 'follow_up' | 'order_taken';
    outcomeNotes?: string;
    amountCollected?: number;
    completedAt?: string;
  }[]>(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
