const VARIANT_PATTERNS: Array<{ tag: string; pattern: RegExp }> = [
  { tag: "karaoke", pattern: /\bkaraoke\b/i },
  { tag: "cover", pattern: /\b(cover|covered by|tribute)\b/i },
  { tag: "live", pattern: /\b(live|concert|tour)\b/i },
  { tag: "acoustic", pattern: /\bacoustic\b/i },
  { tag: "remaster", pattern: /\b(remaster(?:ed)?|deluxe)\b/i },
  { tag: "remix", pattern: /\b(remix|nightcore|slowed(?:\s*\+?\s*reverb)?|sped up|speed up)\b/i },
];

const STRIP_PARENS = /\s*[\(\[][^)\]]*[\)\]]\s*/g;
const STRIP_FEAT = /\s+(feat\.?|ft\.?|featuring)\s+.+$/i;

export function foldMusicText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTitle(title: string) {
  return foldMusicText(title.replace(STRIP_PARENS, " ").replace(STRIP_FEAT, " "));
}

export function normalizeArtist(artist: string) {
  return foldMusicText(artist.replace(STRIP_FEAT, " "));
}

export function detectVariantTag(title: string, extra = "") {
  const haystack = `${title} ${extra}`;
  for (const { tag, pattern } of VARIANT_PATTERNS) {
    if (pattern.test(haystack)) return tag;
  }
  return "studio";
}

export function isAvoidableYouTubeTitle(title: string) {
  return /\b(karaoke|nightcore|slowed|sped up|speed up|lyric(?:s)? video|reaction|cover|8d audio|bass boosted)\b/i.test(
    title,
  );
}

export function isPreferredYouTubeChannel(channel: string) {
  return /\b(topic|official|vevo)\b/i.test(channel);
}

export function durationClose(a: number | null | undefined, b: number | null | undefined, toleranceMs = 2_500) {
  if (typeof a !== "number" || typeof b !== "number") return false;
  return Math.abs(a - b) <= toleranceMs;
}
