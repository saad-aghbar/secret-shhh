import { boolean, jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { autoDownloadEnum, themePreferenceEnum } from "./enums";
import { users } from "./users";

export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  theme: themePreferenceEnum("theme").default("system").notNull(),
  themeLight: jsonb("theme_light").$type<Record<string, unknown>>().default({}).notNull(),
  themeDark: jsonb("theme_dark").$type<Record<string, unknown>>().default({}).notNull(),
  personalWallpaper: jsonb("personal_wallpaper").$type<Record<string, unknown>>().default({}),
  notificationSettings: jsonb("notification_settings")
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
  lowDataMode: boolean("low_data_mode").default(false).notNull(),
  autoDownloadPhotos: autoDownloadEnum("auto_download_photos").default("good_connection").notNull(),
  autoDownloadVideos: autoDownloadEnum("auto_download_videos").default("never").notNull(),
  soundSettings: jsonb("sound_settings").$type<Record<string, unknown>>().default({}).notNull(),
  uiPreferences: jsonb("ui_preferences").$type<Record<string, unknown>>().default({}).notNull(),
  discreetMode: boolean("discreet_mode").default(true).notNull(),
  lockOnLeave: boolean("lock_on_leave").default(true).notNull(),
  blurWhenHidden: boolean("blur_when_hidden").default(true).notNull(),
  showAppBadge: boolean("show_app_badge").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
