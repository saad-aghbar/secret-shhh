-- Phase 11: personal Light/Dark theme configs.
-- The existing theme enum stays the Light / Dark / System mode preference.

ALTER TABLE "user_preferences"
  ADD COLUMN IF NOT EXISTS "theme_light" jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "user_preferences"
  ADD COLUMN IF NOT EXISTS "theme_dark" jsonb NOT NULL DEFAULT '{}'::jsonb;
