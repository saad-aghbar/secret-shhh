import {
  bigint,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { conversations } from "./conversations";
import { users } from "./users";

export const videoUploadStatusEnum = pgEnum("video_upload_status", [
  "pending",
  "uploading",
  "completing",
  "completed",
  "aborted",
  "expired",
]);

/**
 * Ephemeral multipart session. Video bytes live in R2, never Postgres.
 */
export const videoUploadSessions = pgTable(
  "video_upload_sessions",
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
    mediaFolderId: text("media_folder_id").notNull(),
    storageKey: text("storage_key").notNull(),
    providerUploadId: text("provider_upload_id").notNull(),
    originalFilename: text("original_filename"),
    mimeType: text("mime_type").notNull(),
    totalBytes: bigint("total_bytes", { mode: "number" }).notNull(),
    partSize: bigint("part_size", { mode: "number" }).notNull(),
    totalParts: integer("total_parts").notNull(),
    fingerprint: text("fingerprint").notNull(),
    durationMs: integer("duration_ms"),
    width: integer("width"),
    height: integer("height"),
    status: videoUploadStatusEnum("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("video_upload_sessions_storage_key_uidx").on(table.storageKey),
    uniqueIndex("video_upload_sessions_client_uidx").on(
      table.uploaderId,
      table.clientGeneratedId,
    ),
    index("video_upload_sessions_uploader_status_idx").on(table.uploaderId, table.status),
    index("video_upload_sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const videoUploadParts = pgTable(
  "video_upload_parts",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => videoUploadSessions.id, { onDelete: "cascade" }),
    partNumber: integer("part_number").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    etag: text("etag").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.partNumber] }),
    index("video_upload_parts_session_idx").on(table.sessionId),
  ],
);
