"use client";

import { resampleWaveform } from "@/lib/media/waveform";
import { cn } from "@/lib/utils";

type WaveformBarsProps = {
  /** Stored 0–100 buckets, resampled to `bars`. */
  samples: number[];
  bars: number;
  /** 0–1 played fraction. Omit to draw the whole track as played. */
  progress?: number;
  /** Accent reads the same on both bubble sides; love marks a live recording. */
  tone?: "voice" | "recording";
  className?: string;
};

/**
 * Amplitude bars. Purely decorative — the surrounding control owns the label,
 * the value, and the keyboard behaviour.
 */
export function WaveformBars({
  samples,
  bars,
  progress,
  tone = "voice",
  className,
}: WaveformBarsProps) {
  const heights = resampleWaveform(samples, bars);
  const playedUpTo = progress === undefined ? heights.length : progress * heights.length;
  const played = tone === "recording" ? "bg-love" : "bg-accent";
  // Unplayed bars stay clearly visible: the track is the shape of the message.
  const pending = tone === "recording" ? "bg-love/40" : "bg-accent/55";

  return (
    <div className={cn("flex h-full items-center gap-[2px]", className)} aria-hidden>
      {heights.map((height, index) => (
        <span
          key={index}
          data-waveform-bar
          className={cn(
            "w-[3px] shrink-0 rounded-full transition-colors duration-[var(--shhh-motion-fast)] motion-reduce:transition-none",
            index < playedUpTo ? played : pending,
          )}
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );
}
