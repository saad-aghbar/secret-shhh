import { integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { wallpaperModeEnum } from "./enums";
import { users } from "./users";

export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title"),
  wallpaperMode: wallpaperModeEnum("wallpaper_mode").default("none").notNull(),
  wallpaperMediaId: uuid("wallpaper_media_id"),
  wallpaperConfig: jsonb("wallpaper_config").$type<Record<string, unknown>>().default({}).notNull(),
  wallpaperUpdatedBy: uuid("wallpaper_updated_by").references(() => users.id),
  wallpaperVersion: integer("wallpaper_version").default(0).notNull(),
  settings: jsonb("settings").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const conversationMembers = pgTable(
  "conversation_members",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
    lastReadMessageId: uuid("last_read_message_id"),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    notificationPreferences: jsonb("notification_preferences")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.conversationId, table.userId] })],
);
