import { graphemeLength } from "@/lib/text/graphemes";

const SNIPPET_MAX = 140;

/**
 * Grapheme-safe truncation for search previews.
 * Prefer a window around the first case-insensitive match when `q` is present.
 */
export function makeSearchSnippet(text: string, q: string): { snippet: string; matchStart: number | null; matchEnd: number | null } {
  const raw = text.replace(/\s+/gu, " ").trim();
  if (!raw) {
    return { snippet: "", matchStart: null, matchEnd: null };
  }

  const needle = q.trim();
  let matchIndex = -1;
  if (needle) {
    matchIndex = raw.toLocaleLowerCase().indexOf(needle.toLocaleLowerCase());
  }

  if (graphemeLength(raw) <= SNIPPET_MAX) {
    if (matchIndex >= 0) {
      return {
        snippet: raw,
        matchStart: matchIndex,
        matchEnd: matchIndex + needle.length,
      };
    }
    return { snippet: raw, matchStart: null, matchEnd: null };
  }

  // Build grapheme array for safe slicing.
  const graphemes = segmentGraphemes(raw);
  if (matchIndex < 0) {
    const cut = graphemes.slice(0, SNIPPET_MAX).join("");
    return { snippet: `${cut}…`, matchStart: null, matchEnd: null };
  }

  // Center window around match (approx by code-unit index mapped to grapheme index).
  let gStart = 0;
  let gMatch = 0;
  let offset = 0;
  for (let i = 0; i < graphemes.length; i += 1) {
    if (offset <= matchIndex && matchIndex < offset + graphemes[i]!.length) {
      gMatch = i;
      break;
    }
    offset += graphemes[i]!.length;
  }
  const half = Math.floor(SNIPPET_MAX / 2);
  gStart = Math.max(0, gMatch - half);
  const gEnd = Math.min(graphemes.length, gStart + SNIPPET_MAX);
  gStart = Math.max(0, gEnd - SNIPPET_MAX);

  const slice = graphemes.slice(gStart, gEnd).join("");
  const prefix = gStart > 0 ? "…" : "";
  const suffix = gEnd < graphemes.length ? "…" : "";
  const snippet = `${prefix}${slice}${suffix}`;

  // Recompute match offsets inside snippet string.
  const local = snippet.toLocaleLowerCase().indexOf(needle.toLocaleLowerCase());
  if (local >= 0) {
    return {
      snippet,
      matchStart: local,
      matchEnd: local + needle.length,
    };
  }
  return { snippet, matchStart: null, matchEnd: null };
}

function segmentGraphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map(
      (s) => s.segment,
    );
  }
  return [...text];
}

/** Detect quoted exact-phrase queries: `"good night"` */
export function parseSearchQuery(q: string): { mode: "phrase" | "terms"; text: string } {
  const trimmed = q.trim();
  const phrase = /^"([^"]+)"$/.exec(trimmed);
  if (phrase?.[1]) {
    return { mode: "phrase", text: phrase[1].trim() };
  }
  return { mode: "terms", text: trimmed };
}
