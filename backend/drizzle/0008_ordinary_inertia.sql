CREATE TABLE "price_list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"price_list_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"base_price" numeric(15, 2) DEFAULT '0' NOT NULL,
	"selling_price" numeric(15, 2) DEFAULT '0' NOT NULL,
	"list_price" numeric(15, 2) DEFAULT '0' NOT NULL,
	"min_quantity" integer DEFAULT 1 NOT NULL,
	"valid_from" date,
	"valid_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(20) DEFAULT 'sales' NOT NULL,
	"is_global_default" boolean DEFAULT false NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotional_scheme_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheme_id" uuid NOT NULL,
	"product_id" uuid,
	"variant_id" uuid,
	"category_id" uuid
);
--> statement-breakpoint
CREATE TABLE "promotional_schemes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"discount_type" varchar(20) NOT NULL,
	"discount_value" numeric(10, 2) NOT NULL,
	"min_quantity" integer DEFAULT 1 NOT NULL,
	"max_discount_amount" numeric(15, 2),
	"valid_from" date NOT NULL,
	"valid_to" date NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"applies_to" varchar(20) DEFAULT 'all_products' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "contact_custom_price_variant_unique_idx";--> statement-breakpoint
DROP INDEX "contact_custom_price_product_unique_idx";--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "sales_price_list_id" uuid;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "purchase_price_list_id" uuid;--> statement-breakpoint
ALTER TABLE "contact_custom_prices" ADD COLUMN "type" varchar(20) DEFAULT 'sales' NOT NULL;--> statement-breakpoint
ALTER TABLE "contact_custom_prices" ADD COLUMN "valid_from" date;--> statement-breakpoint
ALTER TABLE "contact_custom_prices" ADD COLUMN "valid_to" date;--> statement-breakpoint
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotional_scheme_items" ADD CONSTRAINT "promotional_scheme_items_scheme_id_promotional_schemes_id_fk" FOREIGN KEY ("scheme_id") REFERENCES "public"."promotional_schemes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotional_scheme_items" ADD CONSTRAINT "promotional_scheme_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotional_scheme_items" ADD CONSTRAINT "promotional_scheme_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotional_scheme_items" ADD CONSTRAINT "promotional_scheme_items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotional_schemes" ADD CONSTRAINT "promotional_schemes_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotional_schemes" ADD CONSTRAINT "promotional_schemes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "price_list_item_variant_unique_idx" ON "price_list_items" USING btree ("price_list_id","product_id","variant_id","min_quantity") WHERE "price_list_items"."variant_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "price_list_item_product_unique_idx" ON "price_list_items" USING btree ("price_list_id","product_id","min_quantity") WHERE "price_list_items"."variant_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "promo_scheme_item_variant_unique_idx" ON "promotional_scheme_items" USING btree ("scheme_id","product_id","variant_id") WHERE "promotional_scheme_items"."product_id" is not null and "promotional_scheme_items"."variant_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "promo_scheme_item_product_unique_idx" ON "promotional_scheme_items" USING btree ("scheme_id","product_id") WHERE "promotional_scheme_items"."product_id" is not null and "promotional_scheme_items"."variant_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "promo_scheme_item_category_unique_idx" ON "promotional_scheme_items" USING btree ("scheme_id","category_id") WHERE "promotional_scheme_items"."category_id" is not null;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_sales_price_list_id_price_lists_id_fk" FOREIGN KEY ("sales_price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_purchase_price_list_id_price_lists_id_fk" FOREIGN KEY ("purchase_price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contact_custom_price_variant_unique_idx" ON "contact_custom_prices" USING btree ("org_id","contact_id","product_id","variant_id","type") WHERE "contact_custom_prices"."variant_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "contact_custom_price_product_unique_idx" ON "contact_custom_prices" USING btree ("org_id","contact_id","product_id","type") WHERE "contact_custom_prices"."variant_id" is null;