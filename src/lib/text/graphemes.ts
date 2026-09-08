/**
 * Count Unicode grapheme clusters so emoji sequences / Arabic diacritics
 * are not truncated by byte length.
 */
export function graphemeLength(text: string): number {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].length;
  }
  return [...text].length;
}

export const DEFAULT_MESSAGE_TEXT_MAX_LENGTH = 8_000;
