"use client";

import { MoreHorizontal, Pause, Play } from "lucide-react";
import { useState } from "react";

import { ShhhButton, ShhhSheet } from "@/components/shhh";
import { MusicArtwork } from "@/features/music/music-artwork";
import { useMusicPlayerOptional } from "@/features/music/music-player-provider";
import { formatClipLabel, formatClock } from "@/lib/music/clip";
import { displayArtistName } from "@/lib/music/copy";
import { toQueueItem } from "@/lib/music/player/queue";
import type { BubbleGroup, MusicShareRef } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

function outerRadius(isOwn: boolean, group: BubbleGroup) {
  if (isOwn) {
    if (group === "first") return "rounded-[1.45rem_1.45rem_0.55rem_1.45rem]";
    if (group === "middle") return "rounded-[1.45rem_0.55rem_0.55rem_1.45rem]";
    if (group === "last") return "rounded-[1.45rem_0.55rem_0.55rem_1.45rem]";
    return "rounded-[1.45rem_1.4rem_0.5rem_1.45rem]";
  }
  if (group === "first") return "rounded-[1.45rem_1.45rem_1.45rem_0.55rem]";
  if (group === "middle") return "rounded-[0.55rem_1.45rem_1.45rem_0.55rem]";
  if (group === "last") return "rounded-[0.55rem_1.45rem_1.45rem_0.55rem]";
  return "rounded-[1.45rem_1.45rem_1.45rem_0.5rem]";
}

export function MusicBubble({
  music,
  note,
  isOwn,
  group = "single",
}: {
  music: MusicShareRef;
  note?: string;
  isOwn: boolean;
  group?: BubbleGroup;
}) {
  const player = useMusicPlayerOptional();
  const [peek, setPeek] = useState(false);
  const clip =
    music.clipStartMs != null && music.clipEndMs != null
      ? { startMs: music.clipStartMs, endMs: music.clipEndMs }
      : null;
  const playing =
    player?.current?.trackId === music.trackId &&
    player.status === "playing" &&
    (clip
      ? player.current.clipStartMs === clip.startMs && player.current.clipEndMs === clip.endMs
      : !player.current.clipStartMs);

  function play() {
    player?.playQueue([
      toQueueItem(
        {
          id: music.trackId,
          title: music.title,
          artistName: music.artistName,
          artworkUrl: music.artworkUrl,
          youtubeVideoId: music.youtubeVideoId,
          durationMs: music.durationMs,
        },
        clip ? { clipStartMs: clip.startMs, clipEndMs: clip.endMs } : {},
      ),
    ]);
  }

  function openRowMenu(event: React.MouseEvent) {
    event.stopPropagation();
    event.currentTarget.closest("[data-message-id]")?.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
    );
  }

  return (
    <>
      <div
        className={cn(
          "w-[min(17.5rem,82vw)] p-2 shadow-[var(--shhh-shadow-soft)]",
          isOwn ? "bg-outgoing-bubble text-outgoing-text" : "bg-incoming-bubble text-incoming-text",
          outerRadius(isOwn, group),
        )}
        data-testid="music-bubble"
        data-clip={clip ? "true" : undefined}
      >
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            className="shrink-0"
            data-testid="music-bubble-open"
            aria-label={`Open ${music.title}`}
            onClick={() => setPeek(true)}
          >
            <MusicArtwork src={music.artworkUrl} alt="" size="sm" className="size-12 rounded-[0.95rem]" />
          </button>
          <button
            type="button"
            className="min-w-0 flex-1 text-start"
            onClick={() => setPeek(true)}
          >
            <p className="truncate text-sm font-semibold leading-tight">{music.title}</p>
            <p className="truncate text-xs leading-snug opacity-80">{displayArtistName(music.artistName)}</p>
            {clip ? (
              <p className="mt-0.5 text-[11px] tabular-nums opacity-75">
                {formatClipLabel(clip.startMs, clip.endMs)}
              </p>
            ) : music.durationMs ? (
              <p className="mt-0.5 text-[11px] tabular-nums opacity-75">{formatClock(music.durationMs)}</p>
            ) : null}
          </button>
          <button
            type="button"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--shhh-viewer-ink)_16%,transparent)]"
            aria-label={playing ? "Pause" : "Play"}
            data-testid="music-bubble-play"
            onClick={play}
          >
            {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
          </button>
          <button
            type="button"
            className="grid size-11 shrink-0 place-items-center rounded-full"
            aria-label="More actions"
            data-testid="music-bubble-more"
            data-message-gesture-ignore
            onClick={openRowMenu}
          >
            <MoreHorizontal className="size-4 opacity-70" />
          </button>
        </div>
        {clip && playing ? (
          <div className="bg-[color-mix(in_srgb,currentColor_20%,transparent)] mt-2 h-1 overflow-hidden rounded-full">
            <div
              className="bg-current h-full rounded-full"
              style={{
                width: `${Math.min(100, ((player?.progressMs ?? 0) / Math.max(1, player?.durationMs ?? 1)) * 100)}%`,
              }}
            />
          </div>
        ) : null}
        {note ? (
          <p className="mt-1.5 px-1 text-sm leading-relaxed" dir="auto">
            {note}
          </p>
        ) : null}
      </div>
      <ShhhSheet open={peek} onClose={() => setPeek(false)} title={music.title}>
        <div className="flex items-center gap-3">
          <MusicArtwork src={music.artworkUrl} alt="" size="md" />
          <div className="min-w-0">
            <p className="font-semibold">{music.title}</p>
            <p className="text-secondary-text text-sm">{displayArtistName(music.artistName)}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-2">
          <ShhhButton onClick={play}>{playing ? "Pause" : "Play"}</ShhhButton>
          <a
            href={`/music?track=${music.trackId}`}
            className="bg-bg-soft text-primary-text inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-semibold"
          >
            Open in Music
          </a>
        </div>
      </ShhhSheet>
    </>
  );
}
