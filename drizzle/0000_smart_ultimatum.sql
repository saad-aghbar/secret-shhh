CREATE TYPE "public"."auto_download_preference" AS ENUM('always', 'good_connection', 'never');--> statement-breakpoint
CREATE TYPE "public"."call_status" AS ENUM('ringing', 'connecting', 'connected', 'reconnecting', 'ended', 'missed', 'rejected', 'failed');--> statement-breakpoint
CREATE TYPE "public"."call_type" AS ENUM('audio', 'video');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('image', 'video', 'audio', 'sticker', 'doodle', 'file');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('text', 'image', 'video', 'audio', 'sticker', 'doodle', 'file', 'system', 'call');--> statement-breakpoint
CREATE TYPE "public"."theme_preference" AS ENUM('light', 'dark', 'system');--> statement-breakpoint
CREATE TYPE "public"."upload_status" AS ENUM('pending', 'uploading', 'processing', 'ready', 'failed', 'aborted');--> statement-breakpoint
CREATE TYPE "public"."wallpaper_mode" AS ENUM('solid', 'gradient', 'image', 'none');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"nickname" text,
	"avatar_media_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "conversation_members" (
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_read_message_id" uuid,
	"last_read_at" timestamp with time zone,
	"notification_preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "conversation_members_conversation_id_user_id_pk" PRIMARY KEY("conversation_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text,
	"wallpaper_mode" "wallpaper_mode" DEFAULT 'none' NOT NULL,
	"wallpaper_media_id" uuid,
	"wallpaper_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"client_generated_id" uuid NOT NULL,
	"type" "message_type" NOT NULL,
	"text_content" text,
	"reply_to_message_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"deleted_for_everyone" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"search_vector" "tsvector"
);
--> statement-breakpoint
CREATE TABLE "message_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"uploader_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"preview_storage_key" text,
	"thumbnail_storage_key" text,
	"original_filename" text,
	"mime_type" text NOT NULL,
	"media_type" "media_type" NOT NULL,
	"width" integer,
	"height" integer,
	"duration_ms" integer,
	"original_size_bytes" bigint NOT NULL,
	"preview_size_bytes" bigint,
	"checksum" text,
	"upload_status" "upload_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_receipts" (
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	CONSTRAINT "message_receipts_message_id_user_id_pk" PRIMARY KEY("message_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reactions_message_user_emoji_uid" UNIQUE("message_id","user_id","emoji")
);
--> statement-breakpoint
CREATE TABLE "sticker_favorites" (
	"user_id" uuid NOT NULL,
	"sticker_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sticker_favorites_user_id_sticker_id_pk" PRIMARY KEY("user_id","sticker_id")
);
--> statement-breakpoint
CREATE TABLE "stickers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"preview_storage_key" text,
	"name" text,
	"animated" boolean DEFAULT false NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_by" uuid NOT NULL,
	"type" "call_type" NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"status" "call_status" NOT NULL,
	"end_reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doodles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid,
	"creator_id" uuid NOT NULL,
	"vector_data" jsonb NOT NULL,
	"preview_storage_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"theme" "theme_preference" DEFAULT 'system' NOT NULL,
	"personal_wallpaper" jsonb DEFAULT '{}'::jsonb,
	"notification_settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"low_data_mode" boolean DEFAULT false NOT NULL,
	"auto_download_photos" "auto_download_preference" DEFAULT 'good_connection' NOT NULL,
	"auto_download_videos" "auto_download_preference" DEFAULT 'never' NOT NULL,
	"sound_settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ui_preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_media" ADD CONSTRAINT "message_media_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_media" ADD CONSTRAINT "message_media_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_receipts" ADD CONSTRAINT "message_receipts_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_receipts" ADD CONSTRAINT "message_receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sticker_favorites" ADD CONSTRAINT "sticker_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sticker_favorites" ADD CONSTRAINT "sticker_favorites_sticker_id_stickers_id_fk" FOREIGN KEY ("sticker_id") REFERENCES "public"."stickers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stickers" ADD CONSTRAINT "stickers_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_started_by_users_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doodles" ADD CONSTRAINT "doodles_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doodles" ADD CONSTRAINT "doodles_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "messages_sender_client_generated_uid" ON "messages" USING btree ("sender_id","client_generated_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_created_at_idx" ON "messages" USING btree ("conversation_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "messages_sender_created_at_idx" ON "messages" USING btree ("sender_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "messages_type_created_at_idx" ON "messages" USING btree ("type","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "messages_search_vector_idx" ON "messages" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "message_media_type_created_at_idx" ON "message_media" USING btree ("media_type","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "message_media_uploader_created_at_idx" ON "message_media" USING btree ("uploader_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "message_media_message_id_idx" ON "message_media" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "message_receipts_message_id_idx" ON "message_receipts" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "reactions_message_id_idx" ON "reactions" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "calls_started_at_idx" ON "calls" USING btree ("started_at" DESC NULLS LAST);