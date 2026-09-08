import type { ChatMediaItem } from "@/lib/chat/types";
import type { SharedMediaItemDto } from "@/lib/media/client-api";

/** Shared media rows carry everything ProgressiveImage and PhotoViewer need. */
export function toChatMedia(item: SharedMediaItemDto): ChatMediaItem {
  return {
    id: item.id,
    sortOrder: item.sortOrder,
    mimeType: item.mimeType,
    mediaType: item.mediaType === "video" ? "video" : "image",
    width: item.width,
    height: item.height,
    durationMs: item.durationMs,
    originalSizeBytes: item.originalSizeBytes,
    previewSizeBytes: item.previewSizeBytes,
    originalFilename: item.originalFilename,
    uploadStatus: item.uploadStatus,
    hasPreview: item.hasPreview,
    hasThumbnail: item.hasThumbnail,
  };
}

export function isVideoMedia(item: { mediaType?: string; mimeType?: string }) {
  return item.mediaType === "video" || Boolean(item.mimeType?.startsWith("video/"));
}

export function isLovedByBoth(item: { favoritedBy: string[] }) {
  return item.favoritedBy.length >= 2;
}

export function isFavoritedBy(item: { favoritedBy: string[] }, userId: string) {
  return item.favoritedBy.includes(userId);
}

/** Later pages can repeat a row after a concurrent insert; keys must stay unique. */
export function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}
