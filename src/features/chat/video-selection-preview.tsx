"use client";

import { Pause, Play, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ShhhButton, ShhhIconButton } from "@/components/shhh";
import { formatDurationMs } from "@/lib/media/duration";
import { playMediaElement } from "@/lib/media/play-media";

type VideoSelectionPreviewProps = {
  file: File;
  onCancel: () => void;
  onSend: (file: File, caption: string) => void;
  onRetake?: () => void;
  note?: string;
  disabled?: boolean;
};

export function VideoSelectionPreview({
  file,
  onCancel,
  onSend,
  onRetake,
  note,
  disabled,
}: VideoSelectionPreviewProps) {
  const [caption, setCaption] = useState("");
  const [durationMs, setDurationMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const url = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => {
    return () => URL.revokeObjectURL(url);
  }, [url]);

  return (
    <div
      data-testid="video-selection"
      className="bg-surface-elevated mx-3 mb-1 rounded-[1.85rem] p-3 shadow-[var(--shhh-shadow-float)]"
    >
      <div className="mb-3 flex items-center justify-between gap-3 px-0.5">
        <div className="min-w-0">
          <p className="text-secondary-text text-sm font-medium">1 video</p>
          {note ? <p className="text-muted-text mt-0.5 text-xs">{note}</p> : null}
        </div>
        <ShhhIconButton label="Cancel video selection" className="size-10" onClick={onCancel}>
          <X className="size-5" />
        </ShhhIconButton>
      </div>

      <div className="bg-bg-soft relative mx-auto max-h-[min(52vh,22rem)] overflow-hidden rounded-[1.55rem] shadow-[var(--shhh-shadow-soft)]">
        <video
          ref={videoRef}
          src={url}
          playsInline
          muted
          preload="metadata"
          className="mx-auto max-h-[min(52vh,22rem)] w-full object-contain"
          onLoadedMetadata={(event) => {
            const duration = event.currentTarget.duration;
            if (Number.isFinite(duration)) setDurationMs(Math.round(duration * 1000));
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
        <button
          type="button"
          data-testid="video-preview-play"
          aria-label={playing ? "Pause preview" : "Play preview"}
          className="absolute inset-0 grid place-items-center"
          onClick={() => {
            const node = videoRef.current;
            if (!node) return;
            if (node.paused) playMediaElement(node);
            else node.pause();
          }}
        >
          <span className="grid size-14 place-items-center rounded-full bg-[color-mix(in_srgb,var(--shhh-viewer-ink)_48%,transparent)] text-[var(--shhh-viewer-ivory)] backdrop-blur-sm">
            {playing ? (
              <Pause className="size-6" fill="currentColor" strokeWidth={0} />
            ) : (
              <Play className="ms-0.5 size-6" fill="currentColor" strokeWidth={0} />
            )}
          </span>
        </button>
        {durationMs > 0 ? (
          <span className="absolute end-2.5 bottom-2.5 rounded-full bg-[color-mix(in_srgb,var(--shhh-viewer-ink)_55%,transparent)] px-2 py-0.5 text-[11px] font-semibold text-[var(--shhh-viewer-ivory)] backdrop-blur-sm">
            {formatDurationMs(durationMs)}
          </span>
        ) : null}
        <button
          type="button"
          data-testid="video-remove"
          aria-label="Remove video"
          className="shhh-press absolute top-2.5 right-2.5 z-10 grid size-9 place-items-center rounded-full bg-[color-mix(in_srgb,var(--shhh-text)_55%,transparent)] text-[var(--shhh-bg)] backdrop-blur-sm"
          onClick={onCancel}
        >
          <X className="size-4" />
        </button>
      </div>

      <label className="sr-only" htmlFor="video-caption">
        Caption
      </label>
      <textarea
        id="video-caption"
        data-testid="video-caption"
        dir="auto"
        rows={2}
        maxLength={8000}
        value={caption}
        placeholder="Say something…"
        onChange={(event) => setCaption(event.target.value)}
        className="font-message bg-bg-soft text-primary-text placeholder:text-muted-text mt-3 min-h-12 w-full resize-none rounded-[1.25rem] px-3.5 py-3 text-start outline-none [unicode-bidi:plaintext] focus:ring-2 focus:ring-[var(--shhh-focus-ring)]"
      />
      <div className="mt-3 flex justify-end gap-2">
        {onRetake ? (
          <ShhhButton
            variant="secondary"
            data-testid="video-retake"
            disabled={disabled}
            className="shhh-press"
            onClick={onRetake}
          >
            Retake
          </ShhhButton>
        ) : null}
        <ShhhButton
          data-testid="video-send"
          disabled={disabled}
          className="shhh-press min-w-[7.5rem]"
          onClick={() => onSend(file, caption)}
        >
          Send
        </ShhhButton>
      </div>
    </div>
  );
}
