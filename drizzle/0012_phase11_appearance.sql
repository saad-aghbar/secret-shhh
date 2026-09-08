-- Phase 11: private wallpaper assets and conversation wallpaper versioning.
-- Existing wallpaper_mode / wallpaper_config / personal_wallpaper columns stay as-is.

CREATE TABLE IF NOT EXISTS "wallpaper_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "storage_key" text NOT NULL,
  "mime_type" text NOT NULL,
  "width" integer,
  "height" integer,
  "size_bytes" bigint NOT NULL,
  "upload_status" "upload_status" NOT NULL DEFAULT 'pending',
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "wallpaper_assets_storage_key_uidx"
  ON "wallpaper_assets" ("storage_key");

CREATE INDEX IF NOT EXISTS "wallpaper_assets_conversation_created_at_idx"
  ON "wallpaper_assets" ("conversation_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "wallpaper_assets_owner_created_at_idx"
  ON "wallpaper_assets" ("owner_id", "created_at" DESC);

ALTER TABLE "conversations"
  ADD COLUMN IF NOT EXISTS "wallpaper_updated_by" uuid REFERENCES "users"("id");

ALTER TABLE "conversations"
  ADD COLUMN IF NOT EXISTS "wallpaper_version" integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conversations_wallpaper_media_id_fk'
  ) THEN
    ALTER TABLE "conversations"
      ADD CONSTRAINT "conversations_wallpaper_media_id_fk"
      FOREIGN KEY ("wallpaper_media_id") REFERENCES "wallpaper_assets"("id")
      ON DELETE SET NULL;
  END IF;
END $$;
