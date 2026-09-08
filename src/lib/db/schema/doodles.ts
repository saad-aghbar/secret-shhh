import { index, integer, jsonb, pgTable, real, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import type { DoodleDocument } from "@/lib/doodles/document";
import { messages } from "./messages";
import { users } from "./users";

export const doodles = pgTable(
  "doodles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id").references(() => messages.id, { onDelete: "set null" }),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    vectorVersion: integer("vector_version").notNull().default(1),
    /** Normalized vector stroke data — canonical source of truth. */
    vectorData: jsonb("vector_data").$type<DoodleDocument>().notNull(),
    aspectRatio: real("aspect_ratio").notNull().default(0.8),
    backgroundMode: text("background_mode").notNull().default("paper"),
    strokeCount: integer("stroke_count").notNull().default(0),
    totalPoints: integer("total_points").notNull().default(0),
    payloadBytes: integer("payload_bytes").notNull().default(0),
    previewStorageKey: text("preview_storage_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("doodles_message_id_uid").on(table.messageId),
    index("doodles_creator_created_at_idx").on(table.creatorId, table.createdAt.desc()),
  ],
);
