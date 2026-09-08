import {
  type AnyPgColumn,
  boolean,
  customType,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { conversations } from "./conversations";
import { messageTypeEnum } from "./enums";
import { stickers } from "./stickers";
import { users } from "./users";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    clientGeneratedId: uuid("client_generated_id").notNull(),
    type: messageTypeEnum("type").notNull(),
    textContent: text("text_content"),
    replyToMessageId: uuid("reply_to_message_id").references((): AnyPgColumn => messages.id, {
      onDelete: "set null",
    }),
    stickerId: uuid("sticker_id").references(() => stickers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedForEveryone: boolean("deleted_for_everyone").default(false).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    // Phase 3: maintained by DB trigger via to_tsvector('simple', …) — bilingual-safe
    // (no English stemmer). GIN index below; pg_trgm on text_content for short/partial fallback.
    searchVector: tsvector("search_vector"),
  },
  (table) => [
    uniqueIndex("messages_sender_client_generated_uid").on(
      table.senderId,
      table.clientGeneratedId,
    ),
    index("messages_conversation_created_at_idx").on(table.conversationId, table.createdAt.desc()),
    index("messages_sender_created_at_idx").on(table.senderId, table.createdAt.desc()),
    index("messages_type_created_at_idx").on(table.type, table.createdAt.desc()),
    index("messages_search_vector_idx").using("gin", table.searchVector),
    index("messages_reply_to_message_id_idx").on(table.replyToMessageId),
    index("messages_sticker_id_idx").on(table.stickerId),
  ],
);
