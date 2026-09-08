import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { conversations } from "./conversations";
import {
  musicActivityKindEnum,
  musicLibraryScopeEnum,
  musicProviderEnum,
  musicRecommendationStatusEnum,
} from "./enums";
import { messages } from "./messages";
import { users } from "./users";

/**
 * One canonical recording per conversation.
 * Spotify / Apple / YouTube are sources attached to this row — never duplicate songs.
 */
export const musicTracks = pgTable(
  "music_tracks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    artistName: text("artist_name").notNull(),
    albumTitle: text("album_title"),
    albumArtist: text("album_artist"),
    artworkUrl: text("artwork_url"),
    durationMs: integer("duration_ms"),
    releaseYear: integer("release_year"),
    isrc: text("isrc"),
    normalizedTitle: text("normalized_title").notNull(),
    normalizedArtist: text("normalized_artist").notNull(),
    /** studio | live | acoustic | remaster | cover | remix | karaoke | other */
    variantTag: text("variant_tag").default("studio").notNull(),
    youtubeVideoId: text("youtube_video_id"),
    youtubePlayable: boolean("youtube_playable").default(false).notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("music_tracks_conversation_created_idx").on(
      table.conversationId,
      table.createdAt.desc(),
    ),
    index("music_tracks_conversation_normalized_idx").on(
      table.conversationId,
      table.normalizedTitle,
      table.normalizedArtist,
    ),
    uniqueIndex("music_tracks_conversation_isrc_uid")
      .on(table.conversationId, table.isrc)
      .where(sql`${table.isrc} is not null`),
    uniqueIndex("music_tracks_conversation_youtube_uid")
      .on(table.conversationId, table.youtubeVideoId)
      .where(sql`${table.youtubeVideoId} is not null`),
  ],
);

export const musicTrackSources = pgTable(
  "music_track_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => musicTracks.id, { onDelete: "cascade" }),
    provider: musicProviderEnum("provider").notNull(),
    externalId: text("external_id"),
    url: text("url").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().default({}).notNull(),
    addedBy: uuid("added_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("music_track_sources_track_idx").on(table.trackId),
    uniqueIndex("music_track_sources_canonical_uid").on(table.provider, table.canonicalUrl),
    uniqueIndex("music_track_sources_external_uid")
      .on(table.provider, table.externalId)
      .where(sql`${table.externalId} is not null`),
  ],
);

export const musicLibraryEntries = pgTable(
  "music_library_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => musicTracks.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    scope: musicLibraryScopeEnum("scope").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("music_library_entries_track_idx").on(table.trackId),
    index("music_library_entries_user_created_idx").on(table.userId, table.createdAt.desc()),
    uniqueIndex("music_library_shared_uid")
      .on(table.trackId)
      .where(sql`${table.scope} = 'shared'`),
    uniqueIndex("music_library_personal_uid")
      .on(table.trackId, table.userId)
      .where(sql`${table.scope} = 'personal'`),
  ],
);

/** Per-person favorite. Loved by Both is derived from two rows, never stored. */
export const musicFavorites = pgTable(
  "music_favorites",
  {
    trackId: uuid("track_id")
      .notNull()
      .references(() => musicTracks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.trackId, table.userId] }),
    index("music_favorites_user_created_idx").on(table.userId, table.createdAt.desc()),
  ],
);

export const musicRecommendations = pgTable(
  "music_recommendations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    trackId: uuid("track_id")
      .notNull()
      .references(() => musicTracks.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    note: text("note"),
    status: musicRecommendationStatusEnum("status").default("pending").notNull(),
    clientGeneratedId: uuid("client_generated_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    listenedAt: timestamp("listened_at", { withTimezone: true }),
    reactedAt: timestamp("reacted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("music_recommendations_sender_client_uid").on(
      table.senderId,
      table.clientGeneratedId,
    ),
    index("music_recommendations_recipient_created_idx").on(
      table.recipientId,
      table.createdAt.desc(),
    ),
    index("music_recommendations_sender_created_idx").on(table.senderId, table.createdAt.desc()),
    index("music_recommendations_track_idx").on(table.trackId),
  ],
);

export const musicPlaylists = pgTable(
  "music_playlists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    note: text("note"),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    collaborative: boolean("collaborative").default(false).notNull(),
    coverTrackId: uuid("cover_track_id").references(() => musicTracks.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("music_playlists_conversation_updated_idx").on(
      table.conversationId,
      table.updatedAt.desc(),
    ),
  ],
);

export const musicPlaylistTracks = pgTable(
  "music_playlist_tracks",
  {
    playlistId: uuid("playlist_id")
      .notNull()
      .references(() => musicPlaylists.id, { onDelete: "cascade" }),
    trackId: uuid("track_id")
      .notNull()
      .references(() => musicTracks.id, { onDelete: "cascade" }),
    position: integer("position").default(0).notNull(),
    addedBy: uuid("added_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.playlistId, table.trackId] }),
    index("music_playlist_tracks_position_idx").on(table.playlistId, table.position),
    index("music_playlist_tracks_track_idx").on(table.trackId),
  ],
);

export const musicTrackMemories = pgTable(
  "music_track_memories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => musicTracks.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    text: text("text").notNull(),
    clientGeneratedId: uuid("client_generated_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("music_track_memories_author_client_uid").on(
      table.authorId,
      table.clientGeneratedId,
    ),
    index("music_track_memories_track_created_idx").on(table.trackId, table.createdAt.desc()),
  ],
);

export const musicActivity = pgTable(
  "music_activity",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    kind: musicActivityKindEnum("kind").notNull(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    trackId: uuid("track_id").references(() => musicTracks.id, { onDelete: "set null" }),
    playlistId: uuid("playlist_id").references(() => musicPlaylists.id, { onDelete: "set null" }),
    recommendationId: uuid("recommendation_id").references(() => musicRecommendations.id, {
      onDelete: "set null",
    }),
    dedupeKey: text("dedupe_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("music_activity_dedupe_uid").on(table.dedupeKey),
    index("music_activity_conversation_created_idx").on(
      table.conversationId,
      table.createdAt.desc(),
    ),
  ],
);

export const musicSongOfMoment = pgTable(
  "music_song_of_moment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    trackId: uuid("track_id")
      .notNull()
      .references(() => musicTracks.id, { onDelete: "cascade" }),
    setBy: uuid("set_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("music_song_of_moment_active_uid")
      .on(table.conversationId)
      .where(sql`${table.endedAt} is null`),
    index("music_song_of_moment_conversation_started_idx").on(
      table.conversationId,
      table.startedAt.desc(),
    ),
  ],
);

export const musicRecentlyPlayed = pgTable(
  "music_recently_played",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    trackId: uuid("track_id")
      .notNull()
      .references(() => musicTracks.id, { onDelete: "cascade" }),
    playedAt: timestamp("played_at", { withTimezone: true }).defaultNow().notNull(),
    playCount: integer("play_count").default(1).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.trackId] }),
    index("music_recently_played_user_played_idx").on(table.userId, table.playedAt.desc()),
  ],
);

/** 1:1 with a music chat message. Deleting the message never deletes the track. */
export const musicMessageShares = pgTable(
  "music_message_shares",
  {
    messageId: uuid("message_id")
      .primaryKey()
      .references(() => messages.id, { onDelete: "cascade" }),
    trackId: uuid("track_id")
      .notNull()
      .references(() => musicTracks.id, { onDelete: "restrict" }),
    youtubeVideoId: text("youtube_video_id"),
    clipStartMs: integer("clip_start_ms"),
    clipEndMs: integer("clip_end_ms"),
  },
  (table) => [index("music_message_shares_track_idx").on(table.trackId)],
);

export const musicProviderCache = pgTable(
  "music_provider_cache",
  {
    cacheKey: text("cache_key").primaryKey(),
    provider: text("provider").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("music_provider_cache_expires_idx").on(table.expiresAt)],
);
