import { db, closeDatabase } from '../src/config/database.js';
import { sql } from 'drizzle-orm';

async function wipeData() {
  console.log('Starting data wipe...');
  try {
    await db.execute(sql`
      TRUNCATE TABLE
        products,
        product_variants,
        inventory,
        inventory_transactions,
        warehouses,
        goods_receipts,
        goods_receipt_items,
        orders,
        order_items,
        invoices,
        invoice_line_items,
        dispatches,
        dispatch_items,
        payments,
        payment_allocations
      CASCADE;
    `);
    console.log('Successfully wiped all transactional and product data.');
  } catch (error) {
    console.error('Failed to wipe data:', error);
  } finally {
    await closeDatabase();
  }
}

wipeData();
