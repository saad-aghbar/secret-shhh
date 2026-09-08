import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { conversations } from "./conversations";
import { callStatusEnum, callTypeEnum } from "./enums";
import { users } from "./users";

export const calls = pgTable(
  "calls",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "cascade",
    }),
    startedBy: uuid("started_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    calleeId: uuid("callee_id").references(() => users.id, { onDelete: "restrict" }),
    type: callTypeEnum("type").notNull(),
    roomName: text("room_name"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    ringingAt: timestamp("ringing_at", { withTimezone: true }),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    endedBy: uuid("ended_by").references(() => users.id, { onDelete: "set null" }),
    status: callStatusEnum("status").notNull(),
    endReason: text("end_reason"),
    durationMs: integer("duration_ms"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("calls_started_at_idx").on(table.startedAt.desc()),
    index("calls_conversation_created_at_idx").on(table.conversationId, table.createdAt.desc()),
    uniqueIndex("calls_room_name_uid").on(table.roomName),
  ],
);
