-- Phase 14: discreet privacy preferences. Defaults match Discreet Mode ON.
ALTER TABLE "user_preferences"
  ADD COLUMN IF NOT EXISTS "discreet_mode" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE "user_preferences"
  ADD COLUMN IF NOT EXISTS "lock_on_leave" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE "user_preferences"
  ADD COLUMN IF NOT EXISTS "blur_when_hidden" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE "user_preferences"
  ADD COLUMN IF NOT EXISTS "show_app_badge" boolean NOT NULL DEFAULT false;
