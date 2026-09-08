import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { mediaTypeEnum, uploadStatusEnum } from "./enums";
import { messages } from "./messages";
import { users } from "./users";

export const messageMedia = pgTable(
  "message_media",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    uploaderId: uuid("uploader_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    storageKey: text("storage_key").notNull(),
    previewStorageKey: text("preview_storage_key"),
    thumbnailStorageKey: text("thumbnail_storage_key"),
    originalFilename: text("original_filename"),
    mimeType: text("mime_type").notNull(),
    mediaType: mediaTypeEnum("media_type").notNull(),
    width: integer("width"),
    height: integer("height"),
    durationMs: integer("duration_ms"),
    originalSizeBytes: bigint("original_size_bytes", { mode: "number" }).notNull(),
    previewSizeBytes: bigint("preview_size_bytes", { mode: "number" }),
    checksum: text("checksum"),
    /** Voice only: compact 0–100 amplitude buckets so bars render without decoding audio. */
    waveformSamples: jsonb("waveform_samples").$type<number[]>(),
    uploadStatus: uploadStatusEnum("upload_status").default("pending").notNull(),
    /** Deterministic album order within one message (0-based). */
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("message_media_type_created_at_idx").on(table.mediaType, table.createdAt.desc()),
    index("message_media_uploader_created_at_idx").on(table.uploaderId, table.createdAt.desc()),
    index("message_media_message_id_idx").on(table.messageId),
    index("message_media_message_sort_idx").on(table.messageId, table.sortOrder),
  ],
);
