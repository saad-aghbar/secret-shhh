import { index, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { conversations } from "./conversations";
import { messageMedia } from "./media";
import { users } from "./users";

/**
 * Shared albums curate media that already exists in the conversation.
 * Deleting an album never touches messages, message_media, or storage objects.
 */
export const sharedAlbums = pgTable(
  "shared_albums",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    note: text("note"),
    /** Set null so removing a photo can never leave a dangling cover. */
    coverMediaId: uuid("cover_media_id").references(() => messageMedia.id, {
      onDelete: "set null",
    }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("shared_albums_conversation_updated_idx").on(
      table.conversationId,
      table.updatedAt.desc(),
    ),
  ],
);

export const sharedAlbumItems = pgTable(
  "shared_album_items",
  {
    albumId: uuid("album_id")
      .notNull()
      .references(() => sharedAlbums.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => messageMedia.id, { onDelete: "cascade" }),
    position: integer("position").default(0).notNull(),
    addedBy: uuid("added_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // Composite key makes duplicate membership impossible at the database level.
    primaryKey({ columns: [table.albumId, table.mediaId] }),
    index("shared_album_items_album_position_idx").on(table.albumId, table.position),
    index("shared_album_items_media_idx").on(table.mediaId),
  ],
);

/** Per-person curation. "Loved by both" is derived from two rows, never stored. */
export const mediaFavorites = pgTable(
  "media_favorites",
  {
    mediaId: uuid("media_id")
      .notNull()
      .references(() => messageMedia.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.mediaId, table.userId] }),
    index("media_favorites_user_created_idx").on(table.userId, table.createdAt.desc()),
  ],
);
