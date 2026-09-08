"use client";

import { Heart, Play } from "lucide-react";

import { MusicArtwork } from "@/features/music/music-artwork";
import { formatClock } from "@/lib/music/clip";
import { displayArtistName } from "@/lib/music/copy";
import type { MusicTrackDto } from "@/lib/music/types";
import { cn } from "@/lib/utils";

type MusicTrackRowProps = {
  track: MusicTrackDto;
  subtitle?: string;
  onOpen?: () => void;
  onPlay?: () => void;
  trailing?: React.ReactNode;
  compact?: boolean;
};

export function MusicTrackRow({ track, subtitle, onOpen, onPlay, trailing, compact }: MusicTrackRowProps) {
  return (
    <div
      className={cn(
        "flex min-h-14 items-center gap-3 rounded-[1.25rem] px-1 py-1.5",
        "hover:bg-accent-soft/35",
      )}
      data-testid="music-track-row"
      data-track-id={track.id}
      data-youtube-playable={track.youtubePlayable ? "true" : "false"}
    >
      <button
        type="button"
        className="relative shrink-0"
        onClick={onPlay}
        aria-label={`Play ${track.title}`}
        data-testid="music-track-play"
      >
        <MusicArtwork src={track.artworkUrl} alt="" size={compact ? "sm" : "md"} />
        <span className="pointer-events-none absolute end-1 bottom-1 grid size-7 place-items-center rounded-full bg-[color-mix(in_srgb,var(--shhh-viewer-ink)_55%,transparent)] text-[var(--shhh-viewer-ivory)]">
          <Play className="size-3 fill-current" />
        </span>
      </button>
      <button
        type="button"
        className="min-w-0 flex-1 text-start"
        onClick={onOpen ?? onPlay}
        data-testid="music-track-open"
      >
        <span className="block truncate text-sm font-semibold text-primary-text">{track.title}</span>
        <span className="text-secondary-text mt-0.5 block truncate text-xs">
          {[subtitle ?? displayArtistName(track.artistName), track.durationMs ? formatClock(track.durationMs) : null]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </button>
      {track.lovedByBoth ? (
        <Heart className="text-love size-4 shrink-0 fill-current" aria-label="Loved by both" />
      ) : null}
      {trailing}
    </div>
  );
}
