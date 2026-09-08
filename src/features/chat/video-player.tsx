"use client";

import { Maximize2, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CONSUMER_VIDEO_ERRORS } from "@/lib/media/consumer-errors";
import { videoPreloadMode } from "@/lib/media/download-policy";
import { formatDurationMs } from "@/lib/media/duration";
import { claimPlayback, releasePlayback } from "@/lib/media/playback-coordinator";
import { playMediaElement } from "@/lib/media/play-media";

/** Only one video player is mounted at a time (inside the viewer). */
const PLAYER_ID = "shhh-video-player";

type ShhhVideoPlayerProps = {
  src: string;
  poster?: string;
  durationMs?: number | null;
  onCodecError?: () => void;
};

export function ShhhVideoPlayer({ src, poster, durationMs, onCodecError }: ShhhVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [duration, setDuration] = useState(durationMs ?? 0);
  const [buffering, setBuffering] = useState(false);
  const [codecError, setCodecError] = useState(false);
  const [preload, setPreload] = useState<"metadata" | "none">("metadata");

  useEffect(() => {
    let active = true;
    void videoPreloadMode().then((mode) => {
      if (active) setPreload(mode);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => () => releasePlayback(PLAYER_ID), []);

  const total = duration || durationMs || 0;

  return (
    <div className="absolute inset-0" data-testid="video-player" data-video-chrome>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        playsInline
        preload={preload}
        muted={muted}
        className="absolute inset-0 m-auto max-h-full max-w-full object-contain"
        onPlay={(event) => {
          // A video takes the floor from any voice message that was playing.
          const node = event.currentTarget;
          claimPlayback(PLAYER_ID, () => node.pause());
          setPlaying(true);
          setEnded(false);
        }}
        onPause={() => {
          releasePlayback(PLAYER_ID);
          setPlaying(false);
        }}
        onEnded={() => {
          releasePlayback(PLAYER_ID);
          setEnded(true);
          setPlaying(false);
        }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onTimeUpdate={(event) => setCurrentMs(event.currentTarget.currentTime * 1000)}
        onDurationChange={(event) => {
          const next = event.currentTarget.duration;
          if (Number.isFinite(next)) setDuration(Math.round(next * 1000));
        }}
        onError={() => {
          setCodecError(true);
          onCodecError?.();
        }}
      />

      {buffering && !codecError ? (
        <div
          className="pointer-events-none absolute inset-0 grid place-items-center"
          data-testid="video-buffering"
        >
          <span className="rounded-full bg-[color-mix(in_srgb,var(--shhh-viewer-ink)_48%,transparent)] px-3 py-1.5 text-xs font-medium text-[var(--shhh-viewer-ivory)] backdrop-blur-sm">
            Loading…
          </span>
        </div>
      ) : null}

      {codecError ? (
        <div
          className="absolute inset-0 grid place-items-center px-6"
          data-testid="video-codec-error"
        >
          <p className="max-w-sm text-center text-sm font-medium text-[var(--shhh-viewer-ivory)]">
            {CONSUMER_VIDEO_ERRORS.UNSUPPORTED_PLAYBACK}
          </p>
        </div>
      ) : null}

      <div
        className="absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-[linear-gradient(to_top,color-mix(in_srgb,var(--shhh-viewer-ink)_55%,transparent),transparent)] px-4 pt-8 pb-3"
        data-video-chrome
        onPointerDown={(event) => event.stopPropagation()}
      >
        <label className="sr-only" htmlFor="video-scrubber">
          Video position
        </label>
        <input
          id="video-scrubber"
          data-testid="video-scrubber"
          type="range"
          min={0}
          max={Math.max(1, total)}
          value={Math.min(currentMs, total || 1)}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[color-mix(in_srgb,var(--shhh-viewer-ivory)_28%,transparent)] accent-[var(--shhh-viewer-ivory)]"
          onChange={(event) => {
            const next = Number(event.target.value);
            const node = videoRef.current;
            if (node) node.currentTime = next / 1000;
            setCurrentMs(next);
          }}
        />
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid="video-play-toggle"
            aria-label={ended ? "Replay" : playing ? "Pause" : "Play"}
            className="shhh-press grid size-11 place-items-center rounded-full text-[var(--shhh-viewer-ivory)]"
            onClick={() => {
              const node = videoRef.current;
              if (!node) return;
              const fail = () => {
                setCodecError(true);
                onCodecError?.();
              };
              if (ended) {
                node.currentTime = 0;
                playMediaElement(node, fail);
                return;
              }
              if (node.paused) playMediaElement(node, fail);
              else node.pause();
            }}
          >
            {ended ? (
              <RotateCcw className="size-5" strokeWidth={2.2} />
            ) : playing ? (
              <Pause className="size-5" fill="currentColor" strokeWidth={0} />
            ) : (
              <Play className="ms-0.5 size-5" fill="currentColor" strokeWidth={0} />
            )}
          </button>
          <span className="min-w-[5.5rem] text-xs font-medium text-[var(--shhh-viewer-ivory)]/85">
            {formatDurationMs(currentMs) || "0:00"} / {formatDurationMs(total) || "0:00"}
          </span>
          <span className="flex-1" />
          <button
            type="button"
            data-testid="video-mute"
            aria-label={muted ? "Unmute" : "Mute"}
            className="shhh-press grid size-11 place-items-center rounded-full text-[var(--shhh-viewer-ivory)]"
            onClick={() => {
              const node = videoRef.current;
              const next = !muted;
              setMuted(next);
              if (node) node.muted = next;
            }}
          >
            {muted ? (
              <VolumeX className="size-5" strokeWidth={2.2} />
            ) : (
              <Volume2 className="size-5" strokeWidth={2.2} />
            )}
          </button>
          <button
            type="button"
            data-testid="video-fullscreen"
            aria-label="Fullscreen"
            className="shhh-press grid size-11 place-items-center rounded-full text-[var(--shhh-viewer-ivory)]"
            onClick={() => {
              const node = videoRef.current;
              if (!node) return;
              node.controls = true;
              const webkit = node as HTMLVideoElement & {
                webkitEnterFullscreen?: () => void;
              };
              if (typeof node.requestFullscreen === "function") {
                void node.requestFullscreen();
              } else {
                webkit.webkitEnterFullscreen?.();
              }
            }}
          >
            <Maximize2 className="size-5" strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </div>
  );
}
