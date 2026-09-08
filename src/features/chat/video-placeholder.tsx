"use client";

import { Play } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Intentional still for a video with no poster. Warm, not a broken image and
 * not an infinite loading breathe — padded or undecodable files stay here.
 */
export function VideoStillPlaceholder({
  className,
  showPlay = false,
  testId = "video-poster-placeholder",
}: {
  className?: string;
  showPlay?: boolean;
  testId?: string;
}) {
  return (
    <span
      data-testid={testId}
      className={cn(
        "absolute inset-0 bg-[color-mix(in_srgb,var(--shhh-accent-soft)_40%,var(--shhh-bg-soft))]",
        className,
      )}
    >
      {showPlay ? (
        <span className="absolute inset-0 grid place-items-center" aria-hidden>
          <span className="grid size-9 place-items-center rounded-full bg-[color-mix(in_srgb,var(--shhh-viewer-ink)_48%,transparent)] text-[var(--shhh-viewer-ivory)] backdrop-blur-sm">
            <Play className="ms-px size-4" fill="currentColor" strokeWidth={0} />
          </span>
        </span>
      ) : null}
    </span>
  );
}
