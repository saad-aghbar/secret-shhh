"use client";

import { AudioLines } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { DoodleArt } from "@/features/doodles/doodle-art";
import { replyPreviewLabel } from "@/lib/chat/message-actions";
import type { ReplyPreview } from "@/lib/chat/types";
import { formatDurationMs } from "@/lib/media/duration";
import { getSignedMediaUrl } from "@/lib/media/signed-url-cache";
import { getSignedStickerUrl } from "@/lib/stickers/signed-url-cache";
import { cn } from "@/lib/utils";

type ReplyPreviewStripProps = {
  preview: ReplyPreview;
  senderName: string;
  onOpen?: () => void;
  compact?: boolean;
};

export function ReplyPreviewStrip({
  preview,
  senderName,
  onOpen,
  compact = false,
}: ReplyPreviewStripProps) {
  const [thumb, setThumb] = useState<string | null>(null);
  const deleted = preview.deleted;
  const label = replyPreviewLabel(preview.type, preview.textSnippet, deleted);

  useEffect(() => {
    if (deleted) return;
    let active = true;
    if (preview.type === "sticker" && preview.sticker) {
      void getSignedStickerUrl(preview.sticker.id)
        .then((url) => {
          if (active) setThumb(url);
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }
    if (!preview.mediaPreviewId || preview.type === "audio") return;
    void getSignedMediaUrl(preview.mediaPreviewId, "thumb")
      .then((url) => {
        if (active) setThumb(url);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [deleted, preview.mediaPreviewId, preview.sticker, preview.type]);

  const inner = (
    <>
      <span className="bg-accent/70 absolute inset-y-1.5 left-1.5 w-0.5 rounded-full" aria-hidden />
      {preview.type === "audio" && !deleted ? (
        <span className="bg-accent-soft text-accent-strong grid size-8 shrink-0 place-items-center rounded-[0.7rem]">
          <AudioLines className="size-3.5" strokeWidth={2} />
        </span>
      ) : null}
      {preview.type === "doodle" && preview.doodle && !deleted ? (
        <span className="relative size-8 shrink-0 overflow-hidden rounded-[0.7rem]">
          <DoodleArt document={preview.doodle.document} decorative fit="cover" className="size-full" />
        </span>
      ) : preview.type === "music" && preview.music?.artworkUrl && !deleted ? (
        <span className="relative size-8 shrink-0 overflow-hidden rounded-[0.7rem]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.music.artworkUrl} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
        </span>
      ) : thumb && !deleted ? (
        <span className="relative size-8 shrink-0 overflow-hidden rounded-[0.7rem]">
          <Image src={thumb} alt="" fill unoptimized className="object-cover" sizes="32px" />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="text-accent-strong block truncate text-[11px] font-semibold">
          {deleted ? "Message deleted" : senderName}
        </span>
        <span
          dir="auto"
          className={cn(
            "text-secondary-text block truncate text-[12px] [unicode-bidi:plaintext]",
            deleted && "italic",
          )}
        >
          {deleted
            ? "This message is no longer here."
            : preview.type === "audio" && preview.durationMs
              ? `Voice · ${formatDurationMs(preview.durationMs)}`
              : preview.type === "video" && preview.durationMs
                ? `${label} · ${formatDurationMs(preview.durationMs)}`
                : label}
        </span>
      </span>
    </>
  );

  const className = cn(
    "shhh-reply-preview relative flex w-full items-center gap-2 rounded-[1rem] px-3 py-1.5 pe-2.5 ps-3.5 text-start",
    compact ? "max-w-full" : "max-w-[16rem]",
  );

  if (onOpen && !deleted) {
    return (
      <button
        type="button"
        className={className}
        onClick={onOpen}
        data-testid="reply-preview"
        data-message-gesture-ignore
        aria-label={`Jump to ${senderName}'s message`}
      >
        {inner}
      </button>
    );
  }

  return (
    <div
      className={className}
      data-testid="reply-preview"
      data-deleted={deleted ? "true" : undefined}
    >
      {inner}
    </div>
  );
}
