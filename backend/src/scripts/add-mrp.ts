import postgres from 'postgres';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL as string);

async function addMrpColumn() {
  try {
    console.log('Connecting to database...');
    // Add mrp column with default 0
    await sql`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "mrp" numeric(15,2) DEFAULT '0' NOT NULL;`;
    console.log('Successfully added mrp column to products table.');

    // Update mrp = selling_price for existing products
    const res = await sql`UPDATE "products" SET "mrp" = "selling_price" WHERE "mrp" = 0;`;
    console.log(`Updated existing products to set MRP = selling_price. Rows affected: ${res.count}`);

  } catch (err) {
    console.error('Error executing query', err);
  } finally {
    await sql.end();
  }
}

addMrpColumn();
