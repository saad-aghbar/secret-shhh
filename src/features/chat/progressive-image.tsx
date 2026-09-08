"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { useNearViewport } from "@/features/chat/use-near-viewport";
import type { ChatMediaItem } from "@/lib/chat/types";
import { shouldAutoLoadPhotoPreview } from "@/lib/media/download-policy";
import { getSignedMediaUrl } from "@/lib/media/signed-url-cache";
import { cn } from "@/lib/utils";

type ProgressiveImageProps = {
  media: ChatMediaItem;
  alt?: string;
  className?: string;
  priority?: boolean;
  loadPreview?: "auto" | "always";
  /** Bubble grids use cover; fullscreen viewer uses contain. */
  fit?: "cover" | "contain";
};

export function ProgressiveImage({
  media,
  alt = "Shared photo",
  className,
  priority,
  loadPreview = "auto",
  fit = "cover",
}: ProgressiveImageProps) {
  const [thumb, setThumb] = useState(media.localThumbUrl ?? media.localObjectUrl ?? "");
  const [preview, setPreview] = useState(media.localObjectUrl ?? "");
  const [loaded, setLoaded] = useState(Boolean(media.localObjectUrl));
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const frameRef = useRef<HTMLDivElement | null>(null);
  // Priority images (the first tiles, the viewer) never wait for the observer.
  const near = useNearViewport(frameRef, { enabled: !priority });

  useEffect(() => {
    if (!near) return;
    let active = true;
    if (!media.localThumbUrl && !media.localObjectUrl && media.hasThumbnail) {
      void getSignedMediaUrl(media.id, "thumb")
        .then((url) => active && setThumb(url))
        .catch(() => {
          if (active) setFailed(true);
        });
    }
    if (!media.localObjectUrl && media.hasPreview) {
      void (loadPreview === "always" ? Promise.resolve(true) : shouldAutoLoadPhotoPreview()).then(
        (allowed) => {
          if (!allowed || !active) return;
          void getSignedMediaUrl(media.id, "preview")
            .then((url) => {
              if (!active) return;
              setPreview(url);
              setFailed(false);
            })
            .catch(() => {
              if (active) setFailed(true);
            });
        },
      );
    }
    return () => {
      active = false;
    };
  }, [
    loadPreview,
    media.hasPreview,
    media.hasThumbnail,
    media.id,
    media.localObjectUrl,
    media.localThumbUrl,
    near,
    retryKey,
  ]);

  if (failed && !thumb && !preview) {
    function retry(event: { stopPropagation: () => void }) {
      event.stopPropagation();
      setFailed(false);
      setThumb("");
      setPreview("");
      setLoaded(false);
      setRetryKey((n) => n + 1);
    }

    return (
      <div
        className={cn(
          "bg-bg-soft absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center",
          className,
        )}
        data-testid="photo-load-error"
        onClick={retry}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            retry(event);
          }
        }}
      >
        <p className="text-secondary-text text-sm">
          {media.mediaType === "video" ? "Couldn't load this video" : "Couldn't load this photo"}
        </p>
        {/* Span, not <button>: this overlay lives inside photo/media tile buttons. */}
        <span className="shhh-press text-accent-strong text-sm font-semibold">Retry</span>
      </div>
    );
  }

  const objectClass = fit === "contain" ? "object-contain" : "object-cover";

  return (
    <div
      ref={frameRef}
      className={cn(
        "relative overflow-hidden",
        fit === "contain" ? "bg-transparent" : "bg-bg-soft",
        className,
      )}
    >
      {!thumb && !preview ? (
        <span
          className={cn(
            "animate-shhh-breathe absolute inset-0 motion-reduce:animate-none",
            fit === "contain"
              ? "bg-[color-mix(in_srgb,var(--shhh-viewer-ink-warm)_55%,transparent)]"
              : "bg-[color-mix(in_srgb,var(--shhh-accent-soft)_45%,var(--shhh-bg-soft))]",
          )}
          aria-label={media.mediaType === "video" ? "Loading video" : "Loading photo"}
        />
      ) : null}
      {thumb ? (
        <Image
          src={thumb}
          alt=""
          aria-hidden
          fill
          unoptimized
          sizes={fit === "contain" ? "100vw" : "(max-width: 640px) 85vw, 32rem"}
          className={cn(objectClass, "scale-[1.02] blur-[1.5px]")}
        />
      ) : null}
      {preview ? (
        <Image
          src={preview}
          alt={alt}
          fill
          unoptimized
          priority={priority}
          sizes={fit === "contain" ? "100vw" : "(max-width: 640px) 85vw, 32rem"}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            objectClass,
            "transition-opacity duration-[var(--shhh-motion-slow)] ease-[var(--shhh-ease-settle)] motion-reduce:transition-none",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}
    </div>
  );
}
