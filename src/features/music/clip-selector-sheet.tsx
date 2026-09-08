"use client";

import { useEffect, useMemo, useState } from "react";

import { ShhhButton, ShhhInput, ShhhSheet, ShhhSlider } from "@/components/shhh";
import { MusicArtwork } from "@/features/music/music-artwork";
import { useMusicPlayer } from "@/features/music/music-player-provider";
import { displayArtistName } from "@/lib/music/copy";
import { formatClock, MUSIC_CLIP_MAX_MS, tryValidateClipRange } from "@/lib/music/clip";
import { apiSendMusicMessage } from "@/lib/music/client-api";
import { toQueueItem } from "@/lib/music/player/queue";
import type { MusicTrackDto } from "@/lib/music/types";

type ClipSelectorSheetProps = {
  open: boolean;
  track: MusicTrackDto | null;
  onClose: () => void;
  onSent?: () => void;
};

export function ClipSelectorSheet({ open, track, onClose, onSent }: ClipSelectorSheetProps) {
  const player = useMusicPlayer();
  const duration = track?.durationMs && track.durationMs > 0 ? track.durationMs : 180_000;
  const windowMs = Math.min(MUSIC_CLIP_MAX_MS, duration);
  const [startMs, setStartMs] = useState(0);
  const [note, setNote] = useState("");
  const endMs = Math.min(duration, startMs + windowMs);
  const valid = tryValidateClipRange({ startMs, endMs, durationMs: track?.durationMs });

  /* eslint-disable react-hooks/set-state-in-effect -- reset the 30s window when the song changes */
  useEffect(() => {
    if (open) {
      setStartMs(0);
      setNote("");
    }
  }, [open, track?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const startClock = useMemo(() => formatClock(startMs), [startMs]);
  const endClock = useMemo(() => formatClock(endMs), [endMs]);

  if (!track) return null;

  return (
    <ShhhSheet open={open} onClose={onClose} title="Send a clip">
      <div data-testid="clip-selector">
      <div className="flex items-center gap-3">
        <MusicArtwork src={track.artworkUrl} alt="" size="md" />
        <div>
          <p className="font-semibold">{track.title}</p>
          <p className="text-secondary-text text-sm">{displayArtistName(track.artistName)}</p>
        </div>
      </div>
      <p className="text-secondary-text mt-4 text-sm">Pick up to 30 seconds. We’ll play exactly that slice.</p>
      <div className="mt-4">
        <ShhhSlider
          label="Clip start"
          min={0}
          max={Math.max(0, duration - windowMs)}
          step={250}
          value={startMs}
          onChange={(event) => setStartMs(Number(event.target.value))}
          data-testid="clip-start"
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-xs text-secondary-text">
            Start
            <ShhhInput
              inputMode="numeric"
              value={startClock}
              onChange={(event) => {
                const next = parseClock(event.target.value);
                if (next != null) setStartMs(Math.min(duration, Math.max(0, next)));
              }}
              aria-label="Clip start time"
            />
          </label>
          <label className="text-xs text-secondary-text">
            End
            <ShhhInput
              inputMode="numeric"
              value={endClock}
              onChange={(event) => {
                const next = parseClock(event.target.value);
                if (next == null) return;
                const start = Math.max(0, next - windowMs);
                setStartMs(Math.min(Math.max(0, duration - windowMs), start));
              }}
              aria-label="Clip end time"
            />
          </label>
        </div>
        <label className="mt-3 block text-xs text-secondary-text">
          A little note
          <ShhhInput
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="this part"
            dir="auto"
            data-testid="clip-note"
          />
        </label>
      </div>
      <div className="mt-5 grid gap-2">
        <ShhhButton
          variant="secondary"
          disabled={!valid}
          onClick={() => {
            player.playQueue([
              toQueueItem(track, { clipStartMs: startMs, clipEndMs: endMs }),
            ]);
          }}
        >
          Preview clip
        </ShhhButton>
        <ShhhButton
          disabled={!valid}
          data-testid="clip-send"
          onClick={async () => {
            if (!valid) return;
            await apiSendMusicMessage({
              trackId: track.id,
              clientGeneratedId: crypto.randomUUID(),
              clipStartMs: startMs,
              clipEndMs: endMs,
              youtubeVideoId: track.youtubeVideoId ?? undefined,
              text: note || undefined,
            });
            onSent?.();
            onClose();
          }}
        >
          Send clip
        </ShhhButton>
      </div>
      </div>
    </ShhhSheet>
  );
}

function parseClock(value: string) {
  const match = value.trim().match(/^(\d+):(\d{1,2})$/);
  if (!match) return null;
  return Number(match[1]) * 60_000 + Number(match[2]) * 1_000;
}
