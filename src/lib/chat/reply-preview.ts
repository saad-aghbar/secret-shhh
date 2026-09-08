import type { ChatMessageType, DoodleRef, ReplyPreview, StickerRef } from "@/lib/chat/types";

export const REPLY_SNIPPET_GRAPHEMES = 72;

function graphemeSlice(text: string, max: number): string {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const parts = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)];
    if (parts.length <= max) {
      return text;
    }
    return `${parts
      .slice(0, max)
      .map((part) => part.segment)
      .join("")}…`;
  }
  const units = [...text];
  return units.length <= max ? text : `${units.slice(0, max).join("")}…`;
}

export function snippetFromText(text: string, max = REPLY_SNIPPET_GRAPHEMES): string | null {
  const trimmed = text.replace(/^\s+|\s+$/gu, "");
  if (!trimmed) {
    return null;
  }
  return graphemeSlice(trimmed, max);
}

export function deletedReplyPreview(id: string): ReplyPreview {
  return {
    id,
    senderId: "",
    type: "text",
    textSnippet: null,
    mediaPreviewId: null,
    durationMs: null,
    sticker: null,
    doodle: null,
    music: null,
    deleted: true,
  };
}

export function buildReplyPreview(input: {
  id: string;
  senderId: string;
  type: ChatMessageType;
  textContent: string | null;
  deletedAt: Date | string | null;
  mediaPreviewId?: string | null;
  durationMs?: number | null;
    sticker?: StickerRef | null;
    doodle?: DoodleRef | null;
    music?: import("@/lib/chat/types").MusicShareRef | null;
  }): ReplyPreview {
  if (input.deletedAt) {
    return deletedReplyPreview(input.id);
  }
  return {
    id: input.id,
    senderId: input.senderId,
    type: input.type,
    textSnippet:
      input.type === "sticker"
        ? snippetFromText(input.sticker?.name ?? "")
        : input.type === "doodle"
          ? null
          : input.type === "music"
            ? snippetFromText(
                input.music
                  ? `${input.music.title} — ${input.music.artistName}`
                  : (input.textContent ?? ""),
              )
          : snippetFromText(input.textContent ?? ""),
    mediaPreviewId: input.mediaPreviewId ?? null,
    durationMs: input.durationMs ?? null,
    sticker: input.sticker ?? null,
    doodle: input.doodle ?? null,
    music: input.music ?? null,
    deleted: false,
  };
}
