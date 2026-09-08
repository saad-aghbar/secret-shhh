"use client";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FolderPlus,
  Heart,
  MessageSquare,
  MoreHorizontal,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";

import { ProgressiveImage } from "@/features/chat/progressive-image";
import { ShhhVideoPlayer } from "@/features/chat/video-player";
import type { ChatMediaItem } from "@/lib/chat/types";
import { saveMediaOriginal } from "@/lib/media/save-original";
import { getSignedMediaUrl } from "@/lib/media/signed-url-cache";
import { cn } from "@/lib/utils";

/** Optional Phase 5 actions. Chat passes none, so its viewer is unchanged. */
export type PhotoViewerFavorite = {
  favorited: boolean;
  lovedByBoth: boolean;
  onToggle: () => void;
};

type PhotoViewerProps = {
  open: boolean;
  media: ChatMediaItem[];
  initialIndex?: number;
  senderName?: string;
  caption?: string | null;
  onClose: () => void;
  /** Small context line under the caption, e.g. "Sep 1, 2026 · 7:22 PM". */
  timestampLabel?: string;
  favorite?: PhotoViewerFavorite;
  onJumpToMessage?: () => void;
  onAddToAlbum?: () => void;
  onIndexChange?: (index: number) => void;
};

const viewerMenuItem =
  "shhh-press flex min-h-11 w-full items-center gap-2.5 rounded-[1.15rem] px-4 text-start text-sm font-semibold text-[var(--shhh-viewer-ivory)] hover:bg-[rgb(247_241_232_/0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-accent-soft)]";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function isVideoItem(item: ChatMediaItem) {
  return item.mediaType === "video" || item.mimeType.startsWith("video/");
}

/**
 * Warm bedroom fullscreen media viewer — Shhh, not a generic lightbox.
 * Save: Web Share Level 2 → download → View original. Never fake “Saved”.
 */
export function MediaViewer({
  open,
  media,
  initialIndex = 0,
  senderName,
  caption,
  onClose,
  timestampLabel,
  favorite,
  onJumpToMessage,
  onAddToAlbum,
  onIndexChange,
}: PhotoViewerProps) {
  const [index, setIndex] = useState(initialIndex);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoPoster, setVideoPoster] = useState<string | undefined>();
  const [actionError, setActionError] = useState<string | null>(null);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [saving, setSaving] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragScale, setDragScale] = useState(1);
  const start = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const reduced = prefersReducedMotion();
  const indexChangeRef = useRef(onIndexChange);

  useEffect(() => {
    indexChangeRef.current = onIndexChange;
  }, [onIndexChange]);

  const goTo = useCallback(
    (next: number) => {
      stageRef.current?.querySelector("video")?.pause();
      setIndex((current) => {
        const clamped = Math.max(0, Math.min(media.length - 1, next));
        if (clamped !== current) indexChangeRef.current?.(clamped);
        return clamped;
      });
      setOriginalUrl(null);
      setVideoUrl(null);
      setActionError(null);
      setMoreOpen(false);
      setChromeVisible(true);
    },
    [media.length],
  );

  const move = useCallback(
    (delta: number) => {
      stageRef.current?.querySelector("video")?.pause();
      setIndex((current) => {
        const next = Math.max(0, Math.min(media.length - 1, current + delta));
        if (next !== current) indexChangeRef.current?.(next);
        return next;
      });
      setOriginalUrl(null);
      setVideoUrl(null);
      setActionError(null);
      setMoreOpen(false);
      setChromeVisible(true);
    },
    [media.length],
  );

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [move, onClose, open]);

  useEffect(() => {
    if (!open) return;
    const current = media[Math.max(0, Math.min(media.length - 1, index))];
    if (!current || !isVideoItem(current)) return;
    let active = true;
    if (current.localThumbUrl) {
      const poster = current.localThumbUrl;
      void Promise.resolve().then(() => {
        if (active) setVideoPoster(poster);
      });
    } else if (current.hasPreview || current.hasThumbnail) {
      void getSignedMediaUrl(current.id, current.hasPreview ? "preview" : "thumb")
        .then((url) => active && setVideoPoster(url))
        .catch(() => undefined);
    }
    void getSignedMediaUrl(current.id, "original")
      .then((url) => active && setVideoUrl(url))
      .catch(() => {
        if (active) setActionError("Couldn't play this video.");
      });
    return () => {
      active = false;
    };
  }, [index, media, open]);

  if (!open || typeof document === "undefined" || !media[index]) return null;

  const item = media[index]!;
  const video = isVideoItem(item);
  const photoAlt = senderName
    ? `${video ? "Video" : "Photo"} sent by ${senderName}`
    : video
      ? "Shared video"
      : "Shared photo";
  const captionText = caption?.trim() || null;
  const multi = media.length > 1;
  const backdropOpacity = dragY > 0 ? Math.max(0.55, 1 - dragY / 420) : 1;
  const hasOverflow = Boolean(onJumpToMessage || onAddToAlbum);

  async function savePhoto() {
    setActionError(null);
    setSaving(true);
    setChromeVisible(true);
    try {
      await saveMediaOriginal({
        mediaId: item.id,
        fallbackFilename: item.originalFilename ?? (video ? "video.mp4" : "photo.jpg"),
        mimeType: item.mimeType || (video ? "video/mp4" : "image/jpeg"),
        shareTitle: video ? "Video" : "Photo",
        // A pending video has no local original; a pending photo does.
        localObjectUrl: video ? undefined : item.localObjectUrl,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setActionError(
        video ? "Couldn't prepare this video. Try again." : "Couldn't prepare this photo. Try View original.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function viewOriginal() {
    setActionError(null);
    setChromeVisible(true);
    try {
      const url = item.localObjectUrl ?? (await getSignedMediaUrl(item.id, "original"));
      setOriginalUrl(url);
    } catch {
      setActionError("Couldn't load original. Try again.");
    }
  }

  function onStagePointerDown(event: ReactPointerEvent) {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement | null)?.closest?.("[data-video-chrome]")) return;
    start.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    stageRef.current?.setPointerCapture(event.pointerId);
  }

  function onStagePointerMove(event: ReactPointerEvent) {
    if (!start.current || reduced || start.current.pointerId !== event.pointerId) return;
    const dy = Math.max(0, event.clientY - start.current.y);
    const dx = Math.abs(event.clientX - start.current.x);
    if (dy > 18 && dy > dx * 1.1) {
      setDragY(dy);
      setDragScale(Math.max(0.88, 1 - dy / 980));
    }
  }

  function onStagePointerUp(event: ReactPointerEvent) {
    if (!start.current || start.current.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    start.current = null;
    try {
      stageRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }

    if (dy > 120 && Math.abs(dy) > Math.abs(dx)) {
      onClose();
      setDragY(0);
      setDragScale(1);
      return;
    }
    if (Math.abs(dx) > 70 && Math.abs(dy) < 48) {
      move(dx < 0 ? 1 : -1);
    } else if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
      setChromeVisible((visible) => !visible);
    }
    setDragY(0);
    setDragScale(1);
  }

  function onStagePointerCancel(event: ReactPointerEvent) {
    if (start.current?.pointerId === event.pointerId) start.current = null;
    setDragY(0);
    setDragScale(1);
  }

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[100] flex flex-col bg-[var(--shhh-viewer-ink)]",
        !reduced && "animate-shhh-viewer-enter",
      )}
      role="dialog"
      aria-modal="true"
      aria-label={video ? "Video viewer" : "Photo viewer"}
      data-testid="photo-viewer"
      data-media-kind={video ? "video" : "image"}
      style={{
        // Drag dismiss only — never scale the opaque ink scrim (that leaked chat underneath).
        opacity: backdropOpacity,
        transform: dragY > 0 ? `translateY(${Math.round(dragY * 0.92)}px)` : undefined,
        transition: reduced || dragY > 0 ? "none" : "transform var(--shhh-motion-normal) var(--shhh-ease-settle)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,transparent_35%,rgb(0_0_0_/0.32)_100%)]"
      />

      <header
        className={cn(
          "relative z-20 flex items-center justify-between gap-3 px-3 pt-[calc(var(--shhh-safe-top)+0.65rem)] pb-2 transition-[opacity,transform] duration-[var(--shhh-motion-normal)] ease-[var(--shhh-ease-settle)] motion-reduce:transition-none",
          chromeVisible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-2 opacity-0",
        )}
      >
        <div className="min-w-0 rounded-full bg-[rgb(247_241_232_/0.14)] px-3.5 py-2 shadow-[0_8px_28px_rgb(0_0_0_/0.22)] backdrop-blur-md">
          <p className="truncate text-sm font-semibold tracking-wide text-[var(--shhh-viewer-ivory)]">
            {senderName || (video ? "Video" : "Photo")}
            {multi ? (
              <span className="font-medium text-[var(--shhh-viewer-ivory)]/70">
                {" "}
                · {index + 1} of {media.length}
              </span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          aria-label={video ? "Close video viewer" : "Close photo viewer"}
          className="shhh-press grid size-11 place-items-center rounded-full bg-[rgb(247_241_232_/0.16)] text-[var(--shhh-viewer-ivory)] shadow-[0_8px_28px_rgb(0_0_0_/0.22)] backdrop-blur-md hover:bg-[rgb(247_241_232_/0.26)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-accent-soft)]"
          onClick={onClose}
        >
          <X className="size-5" strokeWidth={2.2} />
        </button>
      </header>

      <div
        ref={stageRef}
        className="relative z-10 min-h-0 flex-1 touch-none select-none"
        style={{
          transform: dragScale !== 1 ? `scale(${dragScale})` : undefined,
          transition:
            dragY > 0 ? "none" : "transform var(--shhh-motion-normal) var(--shhh-ease-settle)",
        }}
        onPointerDown={onStagePointerDown}
        onPointerMove={onStagePointerMove}
        onPointerUp={onStagePointerUp}
        onPointerCancel={onStagePointerCancel}
      >
        <div className="absolute inset-3 overflow-hidden rounded-[1.35rem] sm:inset-6 sm:rounded-[1.75rem]">
          {video ? (
            videoUrl ? (
              <ShhhVideoPlayer
                key={item.id}
                src={videoUrl}
                poster={videoPoster}
                durationMs={item.durationMs}
              />
            ) : (
              <ProgressiveImage
                media={item}
                alt={photoAlt}
                loadPreview="always"
                fit="contain"
                priority
                className="absolute inset-0 bg-transparent"
              />
            )
          ) : originalUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed original URL
            <img
              src={originalUrl}
              alt={photoAlt}
              draggable={false}
              className="absolute inset-0 m-auto max-h-full max-w-full object-contain"
            />
          ) : (
            <ProgressiveImage
              media={item}
              alt={photoAlt}
              loadPreview="always"
              fit="contain"
              priority
              className="absolute inset-0 bg-transparent"
            />
          )}
        </div>

        {multi ? (
          <>
            <button
              type="button"
              aria-label={video ? "Previous video" : "Previous photo"}
              disabled={index === 0}
              className={cn(
                "shhh-press absolute top-1/2 left-2 z-20 grid size-11 -translate-y-1/2 place-items-center rounded-full sm:left-4",
                "bg-[rgb(247_241_232_/0.16)] text-[var(--shhh-viewer-ivory)] backdrop-blur-md",
                "shadow-[0_8px_24px_rgb(0_0_0_/0.22)] hover:bg-[rgb(247_241_232_/0.28)]",
                "disabled:pointer-events-none disabled:opacity-25",
                "transition-opacity duration-[var(--shhh-motion-normal)]",
                chromeVisible ? "opacity-100" : "pointer-events-none opacity-0",
              )}
              onClick={(event) => {
                event.stopPropagation();
                move(-1);
              }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <ChevronLeft className="size-5" strokeWidth={2.2} />
            </button>
            <button
              type="button"
              aria-label={video ? "Next video" : "Next photo"}
              disabled={index === media.length - 1}
              className={cn(
                "shhh-press absolute top-1/2 right-2 z-20 grid size-11 -translate-y-1/2 place-items-center rounded-full sm:right-4",
                "bg-[rgb(247_241_232_/0.16)] text-[var(--shhh-viewer-ivory)] backdrop-blur-md",
                "shadow-[0_8px_24px_rgb(0_0_0_/0.22)] hover:bg-[rgb(247_241_232_/0.28)]",
                "disabled:pointer-events-none disabled:opacity-25",
                "transition-opacity duration-[var(--shhh-motion-normal)]",
                chromeVisible ? "opacity-100" : "pointer-events-none opacity-0",
              )}
              onClick={(event) => {
                event.stopPropagation();
                move(1);
              }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <ChevronRight className="size-5" strokeWidth={2.2} />
            </button>
          </>
        ) : null}
      </div>

      <footer
        className={cn(
          "relative z-20 flex flex-col items-stretch gap-3 px-4 pt-1 pb-[calc(var(--shhh-safe-bottom)+1.25rem)] transition-[opacity,transform] duration-[var(--shhh-motion-normal)] ease-[var(--shhh-ease-settle)] motion-reduce:transition-none",
          chromeVisible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0",
        )}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {multi ? (
          <div className="flex justify-center gap-1.5" aria-hidden>
            {media.map((entry, dotIndex) => (
              <button
                key={entry.id}
                type="button"
                aria-label={video ? `Video ${dotIndex + 1}` : `Photo ${dotIndex + 1}`}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-[var(--shhh-motion-fast)]",
                  dotIndex === index
                    ? "w-5 bg-[var(--shhh-viewer-ivory)]"
                    : "w-1.5 bg-[var(--shhh-viewer-ivory)]/35 hover:bg-[var(--shhh-viewer-ivory)]/55",
                )}
                onClick={() => goTo(dotIndex)}
              />
            ))}
          </div>
        ) : null}

        {captionText ? (
          <p
            dir="auto"
            className="font-message mx-auto max-w-md text-center text-[15px] leading-relaxed text-[var(--shhh-viewer-ivory)]/92 [unicode-bidi:plaintext]"
          >
            {captionText}
          </p>
        ) : null}

        {timestampLabel ? (
          <p className="text-center text-xs font-medium text-[var(--shhh-viewer-ivory)]/60">
            {timestampLabel}
          </p>
        ) : null}

        {actionError ? (
          <p className="text-center text-sm text-[var(--shhh-love-soft)]" role="status">
            {actionError}
          </p>
        ) : null}

        {/* Overflow actions live in a soft popover so the dock stays two buttons wide. */}
        {moreOpen && hasOverflow ? (
          <div
            className="mx-auto flex w-full max-w-md flex-col gap-1 rounded-[1.5rem] bg-[rgb(247_241_232_/0.16)] p-1.5 shadow-[0_16px_48px_rgb(0_0_0_/0.35)] backdrop-blur-xl"
            role="menu"
            data-testid="photo-actions-menu"
          >
            {onJumpToMessage ? (
              <button
                type="button"
                role="menuitem"
                data-testid="photo-jump-to-message"
                className={viewerMenuItem}
                onClick={() => {
                  setMoreOpen(false);
                  onJumpToMessage();
                }}
              >
                <MessageSquare className="size-4 shrink-0" strokeWidth={2.2} />
                Jump to message
              </button>
            ) : null}
            {onAddToAlbum ? (
              <button
                type="button"
                role="menuitem"
                data-testid="photo-add-to-album"
                className={viewerMenuItem}
                onClick={() => {
                  setMoreOpen(false);
                  onAddToAlbum();
                }}
              >
                <FolderPlus className="size-4 shrink-0" strokeWidth={2.2} />
                Add to album
              </button>
            ) : null}
            {video || originalUrl ? null : (
              <button
                type="button"
                role="menuitem"
                data-testid="photo-view-original-menu"
                className={viewerMenuItem}
                onClick={() => {
                  setMoreOpen(false);
                  void viewOriginal();
                }}
              >
                <Eye className="size-4 shrink-0" strokeWidth={2.2} />
                View original
              </button>
            )}
          </div>
        ) : null}

        <div className="mx-auto flex w-full max-w-md items-center justify-center gap-2 rounded-[1.75rem] bg-[rgb(247_241_232_/0.14)] p-1.5 shadow-[0_16px_48px_rgb(0_0_0_/0.35)] backdrop-blur-xl">
          <button
            type="button"
            data-testid="photo-save"
            disabled={saving}
            className="shhh-press flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--shhh-viewer-ivory)] px-4 text-sm font-semibold text-[var(--shhh-viewer-ink-warm)] shadow-[var(--shhh-shadow-soft)] hover:brightness-105 disabled:opacity-60"
            onClick={() => void savePhoto()}
          >
            <Download className="size-4 shrink-0" strokeWidth={2.2} />
            {saving ? "Preparing…" : video ? "Save video" : "Save photo"}
          </button>

          {favorite ? (
            <button
              type="button"
              data-testid="photo-favorite"
              aria-pressed={favorite.favorited}
              aria-label={favorite.favorited ? "Remove from favorites" : "Add to favorites"}
              className="shhh-press grid size-11 shrink-0 place-items-center rounded-full text-[var(--shhh-viewer-ivory)] hover:bg-[rgb(247_241_232_/0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-accent-soft)]"
              onClick={favorite.onToggle}
            >
              <Heart
                className={cn("size-5", favorite.favorited && "animate-shhh-pop")}
                strokeWidth={2.2}
                fill={favorite.favorited || favorite.lovedByBoth ? "currentColor" : "none"}
                style={
                  favorite.favorited || favorite.lovedByBoth
                    ? { color: "var(--shhh-love)" }
                    : undefined
                }
              />
            </button>
          ) : null}

          {hasOverflow ? (
            <button
              type="button"
              data-testid="photo-more-actions"
              aria-expanded={moreOpen}
              aria-label={video ? "More video actions" : "More photo actions"}
              className="shhh-press grid size-11 shrink-0 place-items-center rounded-full text-[var(--shhh-viewer-ivory)] hover:bg-[rgb(247_241_232_/0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-accent-soft)]"
              onClick={() => setMoreOpen((value) => !value)}
            >
              <MoreHorizontal className="size-5" strokeWidth={2.2} />
            </button>
          ) : video ? null : !originalUrl ? (
            <button
              type="button"
              data-testid="photo-view-original"
              className="shhh-press flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold text-[var(--shhh-viewer-ivory)] hover:bg-[rgb(247_241_232_/0.12)]"
              onClick={() => void viewOriginal()}
            >
              <Eye className="size-4 shrink-0" strokeWidth={2.2} />
              View original
            </button>
          ) : (
            <span className="flex min-h-11 flex-1 items-center justify-center px-3 text-sm font-medium text-[var(--shhh-viewer-ivory)]/70">
              Showing original
            </span>
          )}
        </div>

        {hasOverflow && originalUrl ? (
          <p className="text-center text-xs font-medium text-[var(--shhh-viewer-ivory)]/60">
            Showing original
          </p>
        ) : null}
      </footer>
    </div>,
    document.body,
  );
}

/** Thin wrapper so Phase 4/5 call sites keep importing PhotoViewer. */
export function PhotoViewer(props: PhotoViewerProps) {
  return <MediaViewer {...props} />;
}
