-- Phase 10: doodle vector metadata and lookup indexes.
-- Canonical stroke data stays in doodles.vector_data (JSONB). No messages.doodle_id.

ALTER TABLE "doodles"
  ADD COLUMN IF NOT EXISTS "vector_version" integer NOT NULL DEFAULT 1;

ALTER TABLE "doodles"
  ADD COLUMN IF NOT EXISTS "aspect_ratio" real NOT NULL DEFAULT 0.8;

ALTER TABLE "doodles"
  ADD COLUMN IF NOT EXISTS "background_mode" text NOT NULL DEFAULT 'paper';

ALTER TABLE "doodles"
  ADD COLUMN IF NOT EXISTS "stroke_count" integer NOT NULL DEFAULT 0;

ALTER TABLE "doodles"
  ADD COLUMN IF NOT EXISTS "total_points" integer NOT NULL DEFAULT 0;

ALTER TABLE "doodles"
  ADD COLUMN IF NOT EXISTS "payload_bytes" integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "doodles_message_id_uid"
  ON "doodles" ("message_id");

CREATE INDEX IF NOT EXISTS "doodles_creator_created_at_idx"
  ON "doodles" ("creator_id", "created_at" DESC);
