ALTER TABLE "hsn_codes" ADD COLUMN "tax_rate_id" uuid;
--> statement-breakpoint
UPDATE "hsn_codes" SET "tax_rate_id" = (
  SELECT id FROM tax_rates 
  WHERE tax_rates.org_id = hsn_codes.org_id 
    AND tax_rates.rate_percentage = hsn_codes.gst_rate 
  LIMIT 1
);
--> statement-breakpoint
UPDATE "hsn_codes" SET "tax_rate_id" = (
  SELECT id FROM tax_rates 
  WHERE tax_rates.org_id = hsn_codes.org_id 
  LIMIT 1
) WHERE "tax_rate_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "hsn_codes" ALTER COLUMN "tax_rate_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "hsn_codes" DROP COLUMN "gst_rate";
--> statement-breakpoint
ALTER TABLE "hsn_codes" ADD CONSTRAINT "hsn_codes_tax_rate_id_tax_rates_id_fk" FOREIGN KEY ("tax_rate_id") REFERENCES "public"."tax_rates"("id") ON DELETE restrict ON UPDATE no action;