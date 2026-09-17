CREATE TABLE "hsn_rate_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"hsn_code_id" uuid NOT NULL,
	"previous_rate" numeric(5, 2),
	"new_rate" numeric(5, 2) NOT NULL,
	"effective_from" date NOT NULL,
	"reason" text,
	"changed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hsn_codes" ADD COLUMN "org_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "hsn_codes" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hsn_rate_history" ADD CONSTRAINT "hsn_rate_history_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hsn_rate_history" ADD CONSTRAINT "hsn_rate_history_hsn_code_id_hsn_codes_id_fk" FOREIGN KEY ("hsn_code_id") REFERENCES "public"."hsn_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hsn_codes" ADD CONSTRAINT "hsn_codes_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;