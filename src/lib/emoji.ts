/**
 * Grapheme-aware reaction validation.
 * Never use `string.length === 1` — ZWJ sequences, flags, and skin tones
 * are multiple code points in one visible emoji.
 */

export const REACTION_MAX_CODE_POINTS = 16;
export const REACTION_MAX_BYTES = 64;

export const QUICK_REACTIONS = ["❤️", "😂", "🥺", "😮", "😭", "🔥"] as const;
export type QuickReaction = (typeof QUICK_REACTIONS)[number];

function graphemeSegments(value: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value)].map(
      (part) => part.segment,
    );
  }
  return [...value];
}

let rgiEmoji: RegExp | null | undefined;

function rgiEmojiPattern(): RegExp | null {
  if (rgiEmoji !== undefined) {
    return rgiEmoji;
  }
  try {
    rgiEmoji = new RegExp("^\\p{RGI_Emoji}$", "v");
  } catch {
    rgiEmoji = null;
  }
  return rgiEmoji;
}

export function firstGrapheme(value: string): string {
  const trimmed = value.replace(/^\s+|\s+$/gu, "");
  return graphemeSegments(trimmed)[0] ?? "";
}

export function isValidReactionEmoji(value: string): boolean {
  if (!value) {
    return false;
  }
  const graphemes = graphemeSegments(value);
  if (graphemes.length !== 1) {
    return false;
  }
  const emoji = graphemes[0]!;
  if ([...emoji].length > REACTION_MAX_CODE_POINTS) {
    return false;
  }
  if (new TextEncoder().encode(emoji).byteLength > REACTION_MAX_BYTES) {
    return false;
  }
  const rgi = rgiEmojiPattern();
  if (rgi) {
    return rgi.test(emoji);
  }
  return /\p{Extended_Pictographic}/u.test(emoji);
}

export function parseReactionEmoji(value: string): string | null {
  const emoji = firstGrapheme(value);
  return isValidReactionEmoji(emoji) ? emoji : null;
}
