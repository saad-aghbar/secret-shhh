/**
 * Unpredictable sticker keys. Never use display names or original filenames in paths.
 *
 * stickers/{stickerUuid}/original.webp|png|gif
 * stickers/{stickerUuid}/preview.webp
 */
const EXT_BY_MIME: Record<string, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
};

export function stickerExtensionForMime(mimeType: string): string {
  return EXT_BY_MIME[mimeType] ?? "bin";
}

export function buildStickerOriginalKey(stickerUuid: string, mimeType: string): string {
  return `stickers/${stickerUuid}/original.${stickerExtensionForMime(mimeType)}`;
}

export function buildStickerPreviewKey(stickerUuid: string): string {
  return `stickers/${stickerUuid}/preview.webp`;
}
