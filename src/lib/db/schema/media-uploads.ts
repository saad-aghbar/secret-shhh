import {
  bigint,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { conversations } from "./conversations";
import { users } from "./users";

export const mediaUploadVariantEnum = pgEnum("media_upload_variant", [
  "original",
  "preview",
  "thumbnail",
]);

export const mediaUploadSessionStatusEnum = pgEnum("media_upload_session_status", [
  "pending",
  "uploaded",
  "aborted",
  "expired",
  "consumed",
]);

/**
 * Short-lived authorized upload slots before a photo message is finalized.
 * Object keys are server-generated; clients never supply storage paths.
 */
export const mediaUploads = pgTable(
  "media_uploads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    uploaderId: uuid("uploader_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    clientGeneratedId: text("client_generated_id").notNull(),
    clientAssetId: text("client_asset_id").notNull(),
    variant: mediaUploadVariantEnum("variant").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    width: integer("width"),
    height: integer("height"),
    checksum: text("checksum"),
    originalFilename: text("original_filename"),
    status: mediaUploadSessionStatusEnum("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("media_uploads_storage_key_uidx").on(table.storageKey),
    uniqueIndex("media_uploads_client_variant_uidx").on(
      table.uploaderId,
      table.clientGeneratedId,
      table.clientAssetId,
      table.variant,
    ),
    index("media_uploads_uploader_status_idx").on(table.uploaderId, table.status),
    index("media_uploads_expires_at_idx").on(table.expiresAt),
  ],
);
