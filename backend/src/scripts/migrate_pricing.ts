import postgres from 'postgres';
import { env } from '../config/env.js';

const connectionString = env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const sql = postgres(connectionString, { max: 1 });

async function migrate() {
  console.log("Starting migration...");

  try {
    // 1. Create product_pricing_rules table
    await sql`
      CREATE TABLE IF NOT EXISTS "product_pricing_rules" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "org_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "variant_id" uuid,
        "price_list_id" uuid,
        "purchase_mode" varchar(20),
        "list_price" numeric(15, 2) DEFAULT '0',
        "margin_pct" numeric(5, 2) DEFAULT '0',
        "discount_pct" numeric(5, 2) DEFAULT '0',
        "effective_from" timestamp with time zone,
        "effective_to" timestamp with time zone,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `;
    console.log("Created table product_pricing_rules");

    // 2. Add foreign keys
    await sql`
      DO $$ BEGIN
        ALTER TABLE "product_pricing_rules" ADD CONSTRAINT "product_pricing_rules_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `;
    await sql`
      DO $$ BEGIN
        ALTER TABLE "product_pricing_rules" ADD CONSTRAINT "product_pricing_rules_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade ON UPDATE no action;
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `;
    await sql`
      DO $$ BEGIN
        ALTER TABLE "product_pricing_rules" ADD CONSTRAINT "product_pricing_rules_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE cascade ON UPDATE no action;
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `;
    await sql`
      DO $$ BEGIN
        ALTER TABLE "product_pricing_rules" ADD CONSTRAINT "product_pricing_rules_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id") ON DELETE cascade ON UPDATE no action;
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `;
    console.log("Added foreign keys");

    // 3. Add indices
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "product_pricing_rules_variant_price_list_idx" ON "product_pricing_rules" USING btree ("org_id","product_id","variant_id","price_list_id") WHERE variant_id is not null;
    `;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "product_pricing_rules_product_price_list_idx" ON "product_pricing_rules" USING btree ("org_id","product_id","price_list_id") WHERE variant_id is null;
    `;
    console.log("Added indices");

    // 4. Drop columns from products and product_variants
    await sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "purchase_mode";`;
    await sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "margin_pct";`;
    await sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "discount_pct";`;
    await sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "list_price";`;
    
    await sql`ALTER TABLE "product_variants" DROP COLUMN IF EXISTS "purchase_mode";`;
    await sql`ALTER TABLE "product_variants" DROP COLUMN IF EXISTS "margin_pct";`;
    await sql`ALTER TABLE "product_variants" DROP COLUMN IF EXISTS "discount_pct";`;
    await sql`ALTER TABLE "product_variants" DROP COLUMN IF EXISTS "list_price";`;
    console.log("Dropped columns from products and variants");

    console.log("Migration completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await sql.end();
  }
}

migrate();
