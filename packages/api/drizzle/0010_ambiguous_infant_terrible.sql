CREATE TYPE "public"."categorization_feedback" AS ENUM('correct', 'incorrect');--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "categorization_feedback" "categorization_feedback";