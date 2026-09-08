import type { DerivativeMime } from "@/lib/media/encode-derivative";

/**
 * Unpredictable wallpaper keys. Never use display names or original filenames.
 *
 * wallpapers/{conversationId}/{assetUuid}/display.webp|jpg|png|gif
 */
export function wallpaperExtensionForMime(mimeType: string): "webp" | "jpg" | "png" | "gif" {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/gif") return "gif";
  return "webp";
}

export function buildWallpaperDisplayKey(
  conversationId: string,
  assetUuid: string,
  mimeType: DerivativeMime | string = "image/webp",
): string {
  return `wallpapers/${conversationId}/${assetUuid}/display.${wallpaperExtensionForMime(mimeType)}`;
}
