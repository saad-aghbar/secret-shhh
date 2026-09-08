import type { MediaQueryFilters } from "@/features/media/types";

/**
 * One place for media cache identity so realtime invalidation and the
 * component tree can never drift apart.
 */
export const mediaKeys = {
  all: ["media"] as const,
  shared: (userId: string, filters: MediaQueryFilters) =>
    ["media", "shared", userId, filters] as const,
  sharedRoot: (userId: string) => ["media", "shared", userId] as const,
  albums: (userId: string) => ["media", "albums", userId] as const,
  album: (userId: string, albumId: string) => ["media", "album", userId, albumId] as const,
  messageAttachments: (messageId: string) => ["media", "attachments", messageId] as const,
};
