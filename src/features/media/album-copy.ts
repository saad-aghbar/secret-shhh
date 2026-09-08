/**
 * Album chrome is mixed-media. Say "photos" only in genuinely photo-only
 * flows (the composer photo picker, Save photo, the Photos filter pill).
 */

export function albumItemCountLabel(count: number) {
  if (count <= 0) return "Nothing yet";
  return count === 1 ? "1 item" : `${count} items`;
}

export function albumMediaNoun(mediaType: "image" | "video" | string | undefined) {
  return mediaType === "video" ? "video" : "photo";
}
