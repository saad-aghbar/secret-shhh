import {
  bigint,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { conversations } from "./conversations";
import { uploadStatusEnum } from "./enums";
import { users } from "./users";

/**
 * Private wallpaper photos. Not message_media — those rows require a message_id.
 * Keys: wallpapers/{conversationId}/{assetUuid}/display.webp
 */
export const wallpaperAssets = pgTable(
  "wallpaper_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    width: integer("width"),
    height: integer("height"),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    uploadStatus: uploadStatusEnum("upload_status").default("pending").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("wallpaper_assets_storage_key_uidx").on(table.storageKey),
    index("wallpaper_assets_conversation_created_at_idx").on(
      table.conversationId,
      table.createdAt.desc(),
    ),
    index("wallpaper_assets_owner_created_at_idx").on(table.ownerId, table.createdAt.desc()),
  ],
);
