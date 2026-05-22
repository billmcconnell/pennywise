DELETE FROM "categorization_rules"
WHERE id NOT IN (
  SELECT DISTINCT ON (household_id, match_type, pattern) id
  FROM "categorization_rules"
  ORDER BY household_id, match_type, pattern, created_at DESC
);
--> statement-breakpoint
CREATE UNIQUE INDEX "rules_household_matchtype_pattern_uq" ON "categorization_rules" USING btree ("household_id","match_type","pattern");