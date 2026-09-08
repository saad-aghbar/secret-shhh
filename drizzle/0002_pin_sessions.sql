ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_auth_user_id_unique";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "auth_user_id";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_slot" text;--> statement-breakpoint
DELETE FROM "conversation_members";--> statement-breakpoint
DELETE FROM "user_preferences";--> statement-breakpoint
DELETE FROM "users" WHERE "profile_slot" IS NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "profile_slot" SET NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_profile_slot_unique" UNIQUE("profile_slot");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip_hash" text,
	"user_agent_hash" text,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "login_throttle" (
	"key" text PRIMARY KEY NOT NULL,
	"fail_count" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");
