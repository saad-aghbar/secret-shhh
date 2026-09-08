"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { WaveformBars } from "@/features/chat/waveform-bars";
import { formatDurationMs } from "@/lib/media/duration";
import { seekFractionFromPointer, waveformBarCount } from "@/lib/media/waveform";
import { cn } from "@/lib/utils";

type VoiceScrubberProps = {
  samples: number[];
  /** 0–1 played fraction. */
  progress: number;
  durationMs: number;
  onSeek: (fraction: number) => void;
  label: string;
  /** Fixed track width. Omit to fill the parent. */
  widthRem?: number;
  tone?: "voice" | "recording";
  disabled?: boolean;
  className?: string;
};

const STEP_MS = 5_000;

/**
 * The waveform is the scrubber: tap or drag anywhere on it to move through the clip.
 * It is a real slider to a screen reader and to a keyboard, announcing time rather
 * than a meaningless percentage.
 */
export function VoiceScrubber({
  samples,
  progress,
  durationMs,
  onSeek,
  label,
  widthRem,
  tone = "voice",
  disabled = false,
  className,
}: VoiceScrubberProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [bars, setBars] = useState(() => waveformBarCount((widthRem ?? 8.5) * 16));
  const currentMs = Math.round(progress * durationMs);

  useLayoutEffect(() => {
    const node = trackRef.current;
    if (!node) return;
    const apply = () => {
      const next = waveformBarCount(node.getBoundingClientRect().width);
      setBars((current) => (current === next ? current : next));
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(node);
    return () => observer.disconnect();
  }, [widthRem]);

  function seekTo(clientX: number) {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    onSeek(seekFractionFromPointer(clientX, rect));
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (disabled || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    seekTo(event.clientX);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (disabled || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    seekTo(event.clientX);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled || durationMs <= 0) return;
    const step = STEP_MS / durationMs;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      onSeek(Math.min(1, progress + step));
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      onSeek(Math.max(0, progress - step));
    } else if (event.key === "Home") {
      event.preventDefault();
      onSeek(0);
    } else if (event.key === "End") {
      event.preventDefault();
      onSeek(1);
    }
  }

  const clock = formatDurationMs(currentMs) || "0:00";
  const total = formatDurationMs(durationMs) || "0:00";

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.max(0, Math.round(durationMs))}
      aria-valuenow={currentMs}
      aria-valuetext={`${clock} of ${total}`}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      data-testid="voice-scrubber"
      data-message-gesture-ignore
      style={widthRem ? { width: `${widthRem}rem` } : undefined}
      className={cn(
        "flex min-h-11 min-w-0 touch-none items-center rounded-[0.6rem] outline-none select-none",
        "focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)]",
        widthRem ? "max-w-full" : "w-full flex-1",
        disabled ? "cursor-default" : "cursor-pointer",
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    >
      <div className="h-7 w-full min-w-0 overflow-hidden">
        <WaveformBars samples={samples} bars={bars} progress={progress} tone={tone} />
      </div>
    </div>
  );
}
