-- Phase 9: sticker library, archive, and message sticker reference.

ALTER TABLE "stickers"
  ADD COLUMN IF NOT EXISTS "mime_type" text NOT NULL DEFAULT 'image/webp';

ALTER TABLE "stickers"
  ADD COLUMN IF NOT EXISTS "original_size_bytes" bigint NOT NULL DEFAULT 0;

ALTER TABLE "stickers"
  ADD COLUMN IF NOT EXISTS "checksum" text;

ALTER TABLE "stickers"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();

ALTER TABLE "stickers"
  ADD COLUMN IF NOT EXISTS "archived_at" timestamptz;

CREATE INDEX IF NOT EXISTS "stickers_creator_created_at_idx"
  ON "stickers" ("creator_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "sticker_library" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "sticker_id" uuid NOT NULL REFERENCES "stickers"("id") ON DELETE CASCADE,
  "saved_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "sticker_id")
);

CREATE INDEX IF NOT EXISTS "sticker_library_user_saved_idx"
  ON "sticker_library" ("user_id", "saved_at" DESC);

ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "sticker_id" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'messages_sticker_id_fk'
  ) THEN
    ALTER TABLE "messages"
      ADD CONSTRAINT "messages_sticker_id_fk"
      FOREIGN KEY ("sticker_id") REFERENCES "stickers"("id")
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "messages_sticker_id_idx"
  ON "messages" ("sticker_id");
