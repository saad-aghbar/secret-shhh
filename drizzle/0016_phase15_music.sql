-- Phase 15: Our Music.
-- New enum values are added first and never referenced in this file so
-- PostgreSQL can accept ALTER TYPE inside the migration transaction.

ALTER TYPE "message_type" ADD VALUE IF NOT EXISTS 'music';
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "music_provider" AS ENUM ('youtube', 'youtube_music', 'spotify', 'apple_music');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "music_library_scope" AS ENUM ('personal', 'shared');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "music_recommendation_status" AS ENUM (
    'pending', 'opened', 'listened', 'loved', 'liked', 'not_for_me'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "music_activity_kind" AS ENUM (
    'added_library', 'added_playlist', 'recommended', 'loved', 'song_of_moment', 'memory'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "music_tracks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "artist_name" text NOT NULL,
  "album_title" text,
  "album_artist" text,
  "artwork_url" text,
  "duration_ms" integer,
  "release_year" integer,
  "isrc" text,
  "normalized_title" text NOT NULL,
  "normalized_artist" text NOT NULL,
  "variant_tag" text NOT NULL DEFAULT 'studio',
  "youtube_video_id" text,
  "youtube_playable" boolean NOT NULL DEFAULT false,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "music_tracks_conversation_created_idx"
  ON "music_tracks" ("conversation_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "music_tracks_conversation_normalized_idx"
  ON "music_tracks" ("conversation_id", "normalized_title", "normalized_artist");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "music_tracks_conversation_isrc_uid"
  ON "music_tracks" ("conversation_id", "isrc")
  WHERE "isrc" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "music_tracks_conversation_youtube_uid"
  ON "music_tracks" ("conversation_id", "youtube_video_id")
  WHERE "youtube_video_id" IS NOT NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "music_track_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "track_id" uuid NOT NULL REFERENCES "music_tracks"("id") ON DELETE CASCADE,
  "provider" "music_provider" NOT NULL,
  "external_id" text,
  "url" text NOT NULL,
  "canonical_url" text NOT NULL,
  "metadata_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "added_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "music_track_sources_track_idx"
  ON "music_track_sources" ("track_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "music_track_sources_canonical_uid"
  ON "music_track_sources" ("provider", "canonical_url");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "music_track_sources_external_uid"
  ON "music_track_sources" ("provider", "external_id")
  WHERE "external_id" IS NOT NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "music_library_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "track_id" uuid NOT NULL REFERENCES "music_tracks"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
  "scope" "music_library_scope" NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "music_library_entries_scope_user_chk" CHECK (
    ("scope" = 'shared' AND "user_id" IS NULL)
    OR ("scope" = 'personal' AND "user_id" IS NOT NULL)
  )
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "music_library_entries_track_idx"
  ON "music_library_entries" ("track_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "music_library_entries_user_created_idx"
  ON "music_library_entries" ("user_id", "created_at" DESC);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "music_library_shared_uid"
  ON "music_library_entries" ("track_id")
  WHERE "scope" = 'shared';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "music_library_personal_uid"
  ON "music_library_entries" ("track_id", "user_id")
  WHERE "scope" = 'personal';
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "music_favorites" (
  "track_id" uuid NOT NULL REFERENCES "music_tracks"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("track_id", "user_id")
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "music_favorites_user_created_idx"
  ON "music_favorites" ("user_id", "created_at" DESC);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "music_recommendations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "track_id" uuid NOT NULL REFERENCES "music_tracks"("id") ON DELETE CASCADE,
  "sender_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "recipient_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "note" text,
  "status" "music_recommendation_status" NOT NULL DEFAULT 'pending',
  "client_generated_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "opened_at" timestamptz,
  "listened_at" timestamptz,
  "reacted_at" timestamptz
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "music_recommendations_sender_client_uid"
  ON "music_recommendations" ("sender_id", "client_generated_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "music_recommendations_recipient_created_idx"
  ON "music_recommendations" ("recipient_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "music_recommendations_sender_created_idx"
  ON "music_recommendations" ("sender_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "music_recommendations_track_idx"
  ON "music_recommendations" ("track_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "music_playlists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "note" text,
  "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "collaborative" boolean NOT NULL DEFAULT false,
  "cover_track_id" uuid REFERENCES "music_tracks"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "music_playlists_conversation_updated_idx"
  ON "music_playlists" ("conversation_id", "updated_at" DESC);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "music_playlist_tracks" (
  "playlist_id" uuid NOT NULL REFERENCES "music_playlists"("id") ON DELETE CASCADE,
  "track_id" uuid NOT NULL REFERENCES "music_tracks"("id") ON DELETE CASCADE,
  "position" integer NOT NULL DEFAULT 0,
  "added_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "added_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("playlist_id", "track_id")
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "music_playlist_tracks_position_idx"
  ON "music_playlist_tracks" ("playlist_id", "position");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "music_playlist_tracks_track_idx"
  ON "music_playlist_tracks" ("track_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "music_track_memories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "track_id" uuid NOT NULL REFERENCES "music_tracks"("id") ON DELETE CASCADE,
  "author_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "text" text NOT NULL,
  "client_generated_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "music_track_memories_author_client_uid"
  ON "music_track_memories" ("author_id", "client_generated_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "music_track_memories_track_created_idx"
  ON "music_track_memories" ("track_id", "created_at" DESC);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "music_activity" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "kind" "music_activity_kind" NOT NULL,
  "actor_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "track_id" uuid REFERENCES "music_tracks"("id") ON DELETE SET NULL,
  "playlist_id" uuid REFERENCES "music_playlists"("id") ON DELETE SET NULL,
  "recommendation_id" uuid REFERENCES "music_recommendations"("id") ON DELETE SET NULL,
  "dedupe_key" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "music_activity_dedupe_uid"
  ON "music_activity" ("dedupe_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "music_activity_conversation_created_idx"
  ON "music_activity" ("conversation_id", "created_at" DESC);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "music_song_of_moment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "track_id" uuid NOT NULL REFERENCES "music_tracks"("id") ON DELETE CASCADE,
  "set_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "ended_at" timestamptz
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "music_song_of_moment_active_uid"
  ON "music_song_of_moment" ("conversation_id")
  WHERE "ended_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "music_song_of_moment_conversation_started_idx"
  ON "music_song_of_moment" ("conversation_id", "started_at" DESC);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "music_recently_played" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "track_id" uuid NOT NULL REFERENCES "music_tracks"("id") ON DELETE CASCADE,
  "played_at" timestamptz NOT NULL DEFAULT now(),
  "play_count" integer NOT NULL DEFAULT 1,
  PRIMARY KEY ("user_id", "track_id")
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "music_recently_played_user_played_idx"
  ON "music_recently_played" ("user_id", "played_at" DESC);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "music_message_shares" (
  "message_id" uuid PRIMARY KEY REFERENCES "messages"("id") ON DELETE CASCADE,
  "track_id" uuid NOT NULL REFERENCES "music_tracks"("id") ON DELETE RESTRICT,
  "youtube_video_id" text,
  "clip_start_ms" integer,
  "clip_end_ms" integer
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "music_message_shares_track_idx"
  ON "music_message_shares" ("track_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "music_provider_cache" (
  "cache_key" text PRIMARY KEY NOT NULL,
  "provider" text NOT NULL,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "expires_at" timestamptz NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "music_provider_cache_expires_idx"
  ON "music_provider_cache" ("expires_at");
