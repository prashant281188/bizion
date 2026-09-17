import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

async function run() {
  try {
    console.log('Altering payment_status enum...');
    await db.execute(sql`ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'bounced';`);
    await db.execute(sql`ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'presented';`);
    console.log('Added enum values');

    console.log('Adding cheque_date column...');
    await db.execute(sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS cheque_date DATE;`);
    console.log('Added cheque_date column');

    console.log('Migration successful');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
