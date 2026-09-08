import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const stickers = pgTable(
  "stickers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    previewStorageKey: text("preview_storage_key"),
    name: text("name"),
    animated: boolean("animated").default(false).notNull(),
    mimeType: text("mime_type").default("image/webp").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    originalSizeBytes: bigint("original_size_bytes", { mode: "number" }).default(0).notNull(),
    checksum: text("checksum"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  },
  (table) => [
    index("stickers_creator_created_at_idx").on(table.creatorId, table.createdAt.desc()),
  ],
);

export const stickerFavorites = pgTable(
  "sticker_favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stickerId: uuid("sticker_id")
      .notNull()
      .references(() => stickers.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.stickerId] })],
);

export const stickerLibrary = pgTable(
  "sticker_library",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stickerId: uuid("sticker_id")
      .notNull()
      .references(() => stickers.id, { onDelete: "cascade" }),
    savedAt: timestamp("saved_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.stickerId] }),
    index("sticker_library_user_saved_idx").on(table.userId, table.savedAt.desc()),
  ],
);
