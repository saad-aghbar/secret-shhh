import { pgEnum } from "drizzle-orm/pg-core";

export const messageTypeEnum = pgEnum("message_type", [
  "text",
  "image",
  "video",
  "audio",
  "sticker",
  "doodle",
  "file",
  "system",
  "call",
  "music",
]);

export const mediaTypeEnum = pgEnum("media_type", [
  "image",
  "video",
  "audio",
  "sticker",
  "doodle",
  "file",
]);

export const uploadStatusEnum = pgEnum("upload_status", [
  "pending",
  "uploading",
  "processing",
  "ready",
  "failed",
  "aborted",
]);

export const wallpaperModeEnum = pgEnum("wallpaper_mode", ["solid", "gradient", "image", "none"]);

export const callTypeEnum = pgEnum("call_type", ["audio", "video"]);

export const callStatusEnum = pgEnum("call_status", [
  "ringing",
  "connecting",
  "connected",
  "reconnecting",
  "ended",
  "missed",
  "rejected",
  "failed",
  "cancelled",
  "declined",
  "completed",
]);

export const themePreferenceEnum = pgEnum("theme_preference", ["light", "dark", "system"]);

export const autoDownloadEnum = pgEnum("auto_download_preference", [
  "always",
  "good_connection",
  "never",
]);

export const musicProviderEnum = pgEnum("music_provider", [
  "youtube",
  "youtube_music",
  "spotify",
  "apple_music",
]);

export const musicLibraryScopeEnum = pgEnum("music_library_scope", ["personal", "shared"]);

export const musicRecommendationStatusEnum = pgEnum("music_recommendation_status", [
  "pending",
  "opened",
  "listened",
  "loved",
  "liked",
  "not_for_me",
]);

export const musicActivityKindEnum = pgEnum("music_activity_kind", [
  "added_library",
  "added_playlist",
  "recommended",
  "loved",
  "song_of_moment",
  "memory",
]);
