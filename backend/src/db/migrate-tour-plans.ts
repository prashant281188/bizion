import { db } from '../config/database.js';
import { sql } from 'drizzle-orm';

async function run() {
  console.log('Running tour_plans migration...');
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tour_plans (
      id VARCHAR(255) PRIMARY KEY,
      org_id VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      month VARCHAR(50) NOT NULL,
      year VARCHAR(10) NOT NULL,
      cities JSONB NOT NULL DEFAULT '[]'::jsonb,
      planned_visit_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      date_visits JSONB DEFAULT '[]'::jsonb,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    );
  `);
  console.log('✅ tour_plans table created successfully');
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
