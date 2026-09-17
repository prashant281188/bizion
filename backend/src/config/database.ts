import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from './env.js';
import * as schema from '../db/schema/index.js';

/**
 * postgres.js connection instance.
 * Uses connection pooling with sensible defaults for production use.
 */
const connectionString = env.DATABASE_URL;

const client = postgres(connectionString, {
  max: env.NODE_ENV === 'production' ? 20 : 10,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: true,
});

/**
 * Drizzle ORM instance with full schema awareness.
 * This is the primary database interface used throughout the application.
 */
export const db = drizzle(client, {
  schema,
  logger: env.NODE_ENV === 'development',
});

export type Database = typeof db;

/**
 * Gracefully close the database connection pool.
 * Called during application shutdown.
 */
export async function closeDatabase(): Promise<void> {
  await client.end();
}
