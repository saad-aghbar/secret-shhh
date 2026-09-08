import { MAX_PHOTOS_PER_MESSAGE } from "@/lib/media/validation";

export type MediaOrigin = "library" | "camera";

export type MediaSelection =
  | { kind: "photos"; files: File[]; origin: MediaOrigin }
  | { kind: "video"; file: File; origin: MediaOrigin };

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp|tiff?)$/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|webm)$/i;

export function isImageMediaFile(file: File): boolean {
  const mime = file.type.trim().toLowerCase();
  if (mime.startsWith("image/") && !mime.includes("svg")) return true;
  if (mime.startsWith("video/")) return false;
  return IMAGE_EXT.test(file.name);
}

export function isVideoMediaFile(file: File): boolean {
  const mime = file.type.trim().toLowerCase();
  if (mime.startsWith("video/")) return true;
  if (mime.startsWith("image/")) return false;
  return VIDEO_EXT.test(file.name);
}

/**
 * Split a mixed library pick into existing pipelines.
 * Photos collapse into albums of up to 10; each video is its own message.
 * Photos first (in pick order), then videos — nothing is dropped.
 */
export function splitMediaSelection(files: File[], origin: MediaOrigin): MediaSelection[] {
  const photos: File[] = [];
  const videos: File[] = [];
  for (const file of files) {
    if (isImageMediaFile(file)) photos.push(file);
    else if (isVideoMediaFile(file)) videos.push(file);
  }

  const items: MediaSelection[] = [];
  for (let index = 0; index < photos.length; index += MAX_PHOTOS_PER_MESSAGE) {
    items.push({
      kind: "photos",
      files: photos.slice(index, index + MAX_PHOTOS_PER_MESSAGE),
      origin,
    });
  }
  for (const file of videos) {
    items.push({ kind: "video", file, origin });
  }
  return items;
}

export function remainingSelectionNote(remaining: number): string | undefined {
  if (remaining < 1) return undefined;
  if (remaining === 1) return "Videos send one at a time — 1 more after this.";
  return `Videos send one at a time — ${remaining} more after this.`;
}
