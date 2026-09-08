CREATE TABLE IF NOT EXISTS "shared_albums" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"title" text NOT NULL,
	"note" text,
	"cover_media_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shared_album_items" (
	"album_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"added_by" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shared_album_items_album_id_media_id_pk" PRIMARY KEY("album_id","media_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media_favorites" (
	"media_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_favorites_media_id_user_id_pk" PRIMARY KEY("media_id","user_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shared_albums" ADD CONSTRAINT "shared_albums_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shared_albums" ADD CONSTRAINT "shared_albums_cover_media_id_message_media_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."message_media"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shared_albums" ADD CONSTRAINT "shared_albums_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shared_album_items" ADD CONSTRAINT "shared_album_items_album_id_shared_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."shared_albums"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shared_album_items" ADD CONSTRAINT "shared_album_items_media_id_message_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."message_media"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shared_album_items" ADD CONSTRAINT "shared_album_items_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media_favorites" ADD CONSTRAINT "media_favorites_media_id_message_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."message_media"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media_favorites" ADD CONSTRAINT "media_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shared_albums_conversation_updated_idx" ON "shared_albums" USING btree ("conversation_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shared_album_items_album_position_idx" ON "shared_album_items" USING btree ("album_id","position");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shared_album_items_media_idx" ON "shared_album_items" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_favorites_user_created_idx" ON "media_favorites" USING btree ("user_id","created_at" DESC NULLS LAST);
