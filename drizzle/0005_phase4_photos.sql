CREATE TYPE "public"."media_upload_variant" AS ENUM('original', 'preview', 'thumbnail');--> statement-breakpoint
CREATE TYPE "public"."media_upload_session_status" AS ENUM('pending', 'uploaded', 'aborted', 'expired', 'consumed');--> statement-breakpoint
ALTER TABLE "message_media" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE TABLE "media_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uploader_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"client_generated_id" text NOT NULL,
	"client_asset_id" text NOT NULL,
	"variant" "media_upload_variant" NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"width" integer,
	"height" integer,
	"checksum" text,
	"original_filename" text,
	"status" "media_upload_session_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "media_uploads" ADD CONSTRAINT "media_uploads_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_uploads" ADD CONSTRAINT "media_uploads_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_uploads_storage_key_uidx" ON "media_uploads" USING btree ("storage_key");--> statement-breakpoint
CREATE UNIQUE INDEX "media_uploads_client_variant_uidx" ON "media_uploads" USING btree ("uploader_id","client_generated_id","client_asset_id","variant");--> statement-breakpoint
CREATE INDEX "media_uploads_uploader_status_idx" ON "media_uploads" USING btree ("uploader_id","status");--> statement-breakpoint
CREATE INDEX "media_uploads_expires_at_idx" ON "media_uploads" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "message_media_message_sort_idx" ON "message_media" USING btree ("message_id","sort_order");