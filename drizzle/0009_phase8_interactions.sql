-- Phase 8: reply FK, one reaction per person, reaction timestamps.

ALTER TABLE "messages"
  ADD CONSTRAINT "messages_reply_to_message_id_fk"
  FOREIGN KEY ("reply_to_message_id") REFERENCES "messages"("id")
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "messages_reply_to_message_id_idx"
  ON "messages" ("reply_to_message_id");

-- Collapse any pre-existing multi-emoji rows so uniqueness can tighten.
DELETE FROM "reactions" AS r
USING "reactions" AS keep
WHERE r.message_id = keep.message_id
  AND r.user_id = keep.user_id
  AND r.id <> keep.id
  AND (
    r.created_at > keep.created_at
    OR (r.created_at = keep.created_at AND r.id > keep.id)
  );

ALTER TABLE "reactions" DROP CONSTRAINT IF EXISTS "reactions_message_user_emoji_uid";

ALTER TABLE "reactions"
  ADD CONSTRAINT "reactions_message_user_uid" UNIQUE ("message_id", "user_id");

ALTER TABLE "reactions"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();
