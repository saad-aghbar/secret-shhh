const URL_RE = /https?:\/\/[^\s<>"'`]+/gi;

function trimTrailingPunctuation(url: string): string {
  return url.replace(/[),.;:!?،؛.]+$/u, "");
}

export type TextPart = { kind: "text"; value: string } | { kind: "url"; value: string };

/** Split plain text into safe link + text parts. No HTML parsing. */
export function splitTextLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  const re = new RegExp(URL_RE.source, URL_RE.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const raw = match[0];
    const href = trimTrailingPunctuation(raw);
    const start = match.index;
    if (start > last) {
      parts.push({ kind: "text", value: text.slice(last, start) });
    }
    parts.push({ kind: "url", value: href });
    last = start + href.length;
    if (href.length < raw.length) {
      // Put stripped trailing punctuation back as text.
      last = start + href.length;
    }
  }
  if (last < text.length) {
    parts.push({ kind: "text", value: text.slice(last) });
  }
  return parts.length > 0 ? parts : [{ kind: "text", value: text }];
}

export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
