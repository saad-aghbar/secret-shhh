"use client";

import { AudioLines, Music2, Phone } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { VideoStillPlaceholder } from "@/features/chat/video-placeholder";
import { chatFocusHref } from "@/features/chat/focus-navigation";
import { DoodleArt } from "@/features/doodles/doodle-art";
import { SoftMessageHighlight, SoftMessageRow } from "@/features/search/soft-message-row";
import type { DoodleRef } from "@/lib/chat/types";
import { apiGetDoodle } from "@/lib/doodles/client-api";
import type { SearchResultItem } from "@/lib/search/client-api";
import { formatDurationMs } from "@/lib/media/duration";
import { getSignedMediaUrl } from "@/lib/media/signed-url-cache";
import { getSignedStickerUrl } from "@/lib/stickers/signed-url-cache";

type SearchResultItemProps = {
  item: SearchResultItem;
  viewerId: string;
  partnerName: string;
};

export function SearchResultRow({ item, viewerId, partnerName }: SearchResultItemProps) {
  const router = useRouter();
  const senderLabel = item.senderId === viewerId ? "Me" : partnerName;
  const [thumb, setThumb] = useState<string | null>(null);
  const [doodle, setDoodle] = useState<DoodleRef | null>(null);
  const isPhoto = item.type === "image";
  const isVideo = item.type === "video";
  const isVoice = item.type === "audio";
  const isSticker = item.type === "sticker";
  const isDoodle = item.type === "doodle";
  const isCall = item.type === "call";
  const isMusic = item.type === "music";
  const hasThumb = isPhoto || isVideo || isSticker;

  useEffect(() => {
    if (!hasThumb) return;
    let active = true;
    if (isSticker && item.stickerId) {
      void getSignedStickerUrl(item.stickerId)
        .then((url) => {
          if (active) setThumb(url);
        })
        .catch(() => undefined);
    } else if (item.mediaId && item.hasThumbnail) {
      void getSignedMediaUrl(item.mediaId, "thumb")
        .then((url) => {
          if (active) setThumb(url);
        })
        .catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, [hasThumb, isSticker, item.hasThumbnail, item.mediaId, item.stickerId]);

  useEffect(() => {
    if (!isDoodle || !item.doodleId) return;
    let active = true;
    void apiGetDoodle(item.doodleId)
      .then((result) => {
        if (active) setDoodle(result);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [isDoodle, item.doodleId]);

  return (
    <SoftMessageRow
      testId="search-result"
      messageId={item.id}
      senderLabel={senderLabel}
      createdAt={item.createdAt}
      onActivate={() => router.push(chatFocusHref(item.id, "search"))}
    >
      <div className="flex items-start gap-2.5">
        {isCall ? (
          <span
            className="bg-accent-soft text-accent-strong grid size-10 shrink-0 place-items-center rounded-[0.9rem]"
            data-testid="search-result-call-glyph"
            aria-hidden
          >
            <Phone className="size-4" strokeWidth={2} />
          </span>
        ) : null}
        {isMusic ? (
          <span
            className="bg-accent-soft text-accent-strong grid size-10 shrink-0 place-items-center rounded-[0.9rem]"
            data-testid="search-result-music-glyph"
            aria-hidden
          >
            <Music2 className="size-4" strokeWidth={2} />
          </span>
        ) : null}
        {isVoice ? (
          <span
            className="bg-accent-soft text-accent-strong grid size-10 shrink-0 place-items-center rounded-[0.9rem]"
            data-testid="search-result-voice-glyph"
            aria-hidden
          >
            <AudioLines className="size-4" strokeWidth={2} />
          </span>
        ) : null}
        {isDoodle ? (
          <div
            className="relative h-12 w-[2.4rem] shrink-0 overflow-hidden rounded-[0.85rem] shadow-[var(--shhh-shadow-soft)]"
            data-testid="search-result-doodle-thumb"
          >
            {doodle ? (
              <DoodleArt document={doodle.document} decorative className="size-full" />
            ) : (
              <span className="animate-shhh-breathe bg-accent-soft/40 absolute inset-0 motion-reduce:animate-none" />
            )}
          </div>
        ) : null}
        {hasThumb ? (
          <div
            className="bg-bg-soft relative size-11 shrink-0 overflow-hidden rounded-[0.95rem] shadow-[var(--shhh-shadow-soft)]"
            data-testid={
              isSticker
                ? "search-result-sticker-thumb"
                : isVideo
                  ? "search-result-video-thumb"
                  : "search-result-photo-thumb"
            }
          >
            {thumb ? (
              <Image src={thumb} alt="" fill unoptimized className="object-cover" sizes="44px" />
            ) : isVideo && !item.hasThumbnail ? (
              <VideoStillPlaceholder />
            ) : (
              <span className="animate-shhh-breathe bg-accent-soft/40 absolute inset-0 motion-reduce:animate-none" />
            )}
            {isVideo && item.durationMs ? (
              <span className="absolute inset-x-0 bottom-0 bg-[color-mix(in_srgb,var(--shhh-viewer-ink)_55%,transparent)] text-center text-[8px] font-semibold text-[var(--shhh-viewer-ivory)]">
                {formatDurationMs(item.durationMs)}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          {item.isReply ? (
            <span className="text-accent-strong mb-0.5 block text-[11px] font-semibold" data-testid="search-reply">
              Reply
            </span>
          ) : null}
          <SoftMessageHighlight
            snippet={
              item.snippet ||
              (isPhoto
                ? "Photo"
                : isVideo
                  ? "Video"
                  : isVoice
                    ? "Voice message"
                    : isSticker
                      ? "Sticker"
                      : isDoodle
                        ? "Doodle"
                        : isCall
                          ? item.snippet || "Call"
                          : isMusic
                            ? item.snippet || "Song"
                            : "")
            }
            matchStart={item.matchStart}
            matchEnd={item.matchEnd}
          />
          {isVoice && item.durationMs ? (
            <span className="text-muted-text mt-0.5 block text-[11px] tabular-nums">
              {formatDurationMs(item.durationMs)}
            </span>
          ) : null}
        </div>
      </div>
    </SoftMessageRow>
  );
}
