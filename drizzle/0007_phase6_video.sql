CREATE TYPE "public"."video_upload_status" AS ENUM('pending', 'uploading', 'completing', 'completed', 'aborted', 'expired');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "video_upload_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uploader_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"client_generated_id" text NOT NULL,
	"client_asset_id" text NOT NULL,
	"media_folder_id" text NOT NULL,
	"storage_key" text NOT NULL,
	"provider_upload_id" text NOT NULL,
	"original_filename" text,
	"mime_type" text NOT NULL,
	"total_bytes" bigint NOT NULL,
	"part_size" bigint NOT NULL,
	"total_parts" integer NOT NULL,
	"fingerprint" text NOT NULL,
	"duration_ms" integer,
	"width" integer,
	"height" integer,
	"status" "video_upload_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "video_upload_parts" (
	"session_id" uuid NOT NULL,
	"part_number" integer NOT NULL,
	"size_bytes" bigint NOT NULL,
	"etag" text NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_upload_parts_session_id_part_number_pk" PRIMARY KEY("session_id","part_number")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "video_upload_sessions" ADD CONSTRAINT "video_upload_sessions_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "video_upload_sessions" ADD CONSTRAINT "video_upload_sessions_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "video_upload_parts" ADD CONSTRAINT "video_upload_parts_session_id_video_upload_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."video_upload_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "video_upload_sessions_storage_key_uidx" ON "video_upload_sessions" USING btree ("storage_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "video_upload_sessions_client_uidx" ON "video_upload_sessions" USING btree ("uploader_id","client_generated_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_upload_sessions_uploader_status_idx" ON "video_upload_sessions" USING btree ("uploader_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_upload_sessions_expires_at_idx" ON "video_upload_sessions" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_upload_parts_session_idx" ON "video_upload_parts" USING btree ("session_id");
