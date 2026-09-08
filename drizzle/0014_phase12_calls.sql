-- Phase 12 + 13: unified calls lifecycle.
-- New enum values are added first and never referenced in this file so
-- PostgreSQL can accept ALTER TYPE inside the migration transaction.

ALTER TYPE "call_status" ADD VALUE IF NOT EXISTS 'cancelled';
--> statement-breakpoint
ALTER TYPE "call_status" ADD VALUE IF NOT EXISTS 'declined';
--> statement-breakpoint
ALTER TYPE "call_status" ADD VALUE IF NOT EXISTS 'completed';
--> statement-breakpoint

ALTER TABLE "calls"
  ADD COLUMN IF NOT EXISTS "conversation_id" uuid REFERENCES "conversations"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "calls"
  ADD COLUMN IF NOT EXISTS "callee_id" uuid REFERENCES "users"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "calls"
  ADD COLUMN IF NOT EXISTS "room_name" text;
--> statement-breakpoint
ALTER TABLE "calls"
  ADD COLUMN IF NOT EXISTS "ringing_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "calls"
  ADD COLUMN IF NOT EXISTS "ended_by" uuid REFERENCES "users"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "calls"
  ADD COLUMN IF NOT EXISTS "duration_ms" integer;
--> statement-breakpoint
ALTER TABLE "calls"
  ADD COLUMN IF NOT EXISTS "created_at" timestamptz NOT NULL DEFAULT now();
--> statement-breakpoint
ALTER TABLE "calls"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();
--> statement-breakpoint

UPDATE "calls" SET "ringing_at" = "started_at" WHERE "ringing_at" IS NULL;
--> statement-breakpoint
UPDATE "calls" SET "room_name" = 'shhh-call-legacy-' || "id"::text WHERE "room_name" IS NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "calls_room_name_uid" ON "calls" ("room_name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calls_conversation_created_at_idx" ON "calls" ("conversation_id", "created_at" DESC);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "calls_one_live_per_conversation_uid"
  ON "calls" ("conversation_id")
  WHERE "status" IN ('ringing', 'connecting', 'connected', 'reconnecting');
