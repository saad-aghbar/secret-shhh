"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";

import { VideoStillPlaceholder } from "@/features/chat/video-placeholder";
import type { AlbumCoverDto } from "@/lib/media/client-api";
import { getSignedMediaUrl } from "@/lib/media/signed-url-cache";
import { cn } from "@/lib/utils";

/**
 * Album cover image. Uses the shared signed-URL cache — no album-specific
 * media access path and never a raw object URL.
 */
export function AlbumCoverImage({
  cover,
  variant = "thumb",
  className,
  sizes = "(max-width: 640px) 50vw, 20rem",
}: {
  cover: AlbumCoverDto | null;
  variant?: "thumb" | "preview";
  className?: string;
  sizes?: string;
}) {
  // Keyed by media id so switching covers clears the old image without a
  // synchronous setState in the effect body.
  const [resolved, setResolved] = useState<{ mediaId: string; url: string } | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const mediaId = cover?.mediaId ?? null;
  const hasPoster = Boolean(cover?.hasPreview || cover?.hasThumbnail);
  const url = resolved && resolved.mediaId === mediaId ? resolved.url : null;
  const loaded = loadedId === mediaId;

  useEffect(() => {
    if (!mediaId || !hasPoster) return;
    let active = true;
    void getSignedMediaUrl(mediaId, variant)
      .then((next) => active && setResolved({ mediaId, url: next }))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [hasPoster, mediaId, variant]);

  if (!cover) {
    return (
      <div
        className={cn(
          // Warm blush rather than sage: an empty album should read as waiting,
          // not as a failed image.
          "grid place-items-center bg-[color-mix(in_srgb,var(--shhh-love-soft)_55%,var(--shhh-surface))]",
          className,
        )}
        aria-hidden
      >
        <ImageIcon className="size-7 text-secondary-text/60" strokeWidth={1.7} />
      </div>
    );
  }

  if (!hasPoster) {
    return (
      <div className={cn("relative overflow-hidden bg-bg-soft", className)}>
        <VideoStillPlaceholder showPlay={cover.mediaType === "video"} />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-bg-soft", className)}>
      {!url ? (
        <span className="absolute inset-0 animate-shhh-breathe bg-[color-mix(in_srgb,var(--shhh-accent-soft)_45%,var(--shhh-bg-soft))] motion-reduce:animate-none" />
      ) : (
        <Image
          src={url}
          alt=""
          aria-hidden
          fill
          unoptimized
          sizes={sizes}
          onLoad={() => setLoadedId(mediaId)}
          className={cn(
            "object-cover transition-opacity duration-[var(--shhh-motion-slow)] ease-[var(--shhh-ease-settle)] motion-reduce:transition-none",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </div>
  );
}
