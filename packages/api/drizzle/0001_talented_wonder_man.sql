CREATE TYPE "public"."rule_match_type" AS ENUM('merchant_contains', 'merchant_equals', 'description_contains', 'description_regex');--> statement-breakpoint
CREATE TABLE "categorization_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"match_type" "rule_match_type" NOT NULL,
	"pattern" text NOT NULL,
	"case_insensitive" boolean DEFAULT true NOT NULL,
	"category_id" uuid NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rules_household_idx" ON "categorization_rules" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "rules_priority_idx" ON "categorization_rules" USING btree ("household_id","enabled","priority");