"use client";

import { Check, Heart, Images, Play } from "lucide-react";
import type { CSSProperties } from "react";

import { ProgressiveImage } from "@/features/chat/progressive-image";
import { VideoStillPlaceholder } from "@/features/chat/video-placeholder";
import { isVideoMedia, toChatMedia } from "@/features/media/media-utils";
import type { SharedMediaItemDto } from "@/lib/media/client-api";
import { formatDurationMs } from "@/lib/media/duration";
import { cn } from "@/lib/utils";

export type MediaTileProps = {
  item: SharedMediaItemDto;
  /** Accessible label — thumbnails are decorative, the button carries meaning. */
  label: string;
  /** Noun phrase for secondary controls, e.g. "photo from Tala". */
  subject?: string;
  onOpen?: () => void;
  favorited?: boolean;
  lovedByBoth?: boolean;
  onToggleFavorite?: () => void;
  selectable?: boolean;
  selected?: boolean;
  priority?: boolean;
  style?: CSSProperties;
  className?: string;
};

/**
 * Fixed-square tile. The aspect is owned by the container, never by the
 * intrinsic image ratio, so a very tall or very wide photo can't warp the grid.
 */
export function MediaTile({
  item,
  label,
  subject = "this photo",
  onOpen,
  favorited = false,
  lovedByBoth = false,
  onToggleFavorite,
  selectable = false,
  selected = false,
  priority,
  style,
  className,
}: MediaTileProps) {
  const showHeart = favorited || lovedByBoth;
  const video = isVideoMedia(item);
  const hasPoster = item.hasPreview || item.hasThumbnail;

  return (
    <div className={cn("group/tile relative", className)} style={style}>
      <button
        type="button"
        data-testid={selectable ? "media-select-tile" : "media-thumb"}
        data-media-id={item.id}
        data-selected={selectable ? (selected ? "true" : "false") : undefined}
        data-favorited={favorited ? "true" : "false"}
        aria-label={label}
        aria-pressed={selectable ? selected : undefined}
        className={cn(
          "relative block aspect-square w-full overflow-hidden rounded-[1.15rem] bg-bg-soft",
          "shadow-[var(--shhh-shadow-soft)]",
          "transition-[transform,box-shadow,opacity] duration-[var(--shhh-motion-normal)] ease-[var(--shhh-ease-settle)]",
          "hover:-translate-y-0.5 hover:shadow-[var(--shhh-shadow-float)]",
          "active:scale-[0.975]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100",
          selected && "ring-2 ring-accent ring-offset-2 ring-offset-background",
        )}
        onClick={onOpen}
      >
        {video && !hasPoster ? (
          <VideoStillPlaceholder />
        ) : (
          <ProgressiveImage
            media={toChatMedia(item)}
            alt=""
            fit="cover"
            loadPreview="auto"
            priority={priority}
            className="absolute inset-0 h-full w-full"
          />
        )}

        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,color-mix(in_srgb,var(--shhh-viewer-ink)_28%,transparent),transparent_42%)]",
            "opacity-0 transition-opacity duration-[var(--shhh-motion-normal)] motion-reduce:transition-none",
            "group-hover/tile:opacity-100",
            showHeart && "opacity-100",
          )}
        />

        {video ? (
          <>
            <span
              className="pointer-events-none absolute inset-0 grid place-items-center"
              aria-hidden
            >
              <span className="grid size-9 place-items-center rounded-full bg-[color-mix(in_srgb,var(--shhh-viewer-ink)_48%,transparent)] text-[var(--shhh-viewer-ivory)] backdrop-blur-sm">
                <Play className="ms-px size-4" fill="currentColor" strokeWidth={0} />
              </span>
            </span>
            {item.durationMs ? (
              <span className="absolute start-1.5 bottom-1.5 rounded-full bg-[color-mix(in_srgb,var(--shhh-viewer-ink)_52%,transparent)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--shhh-viewer-ivory)] backdrop-blur-sm">
                {formatDurationMs(item.durationMs)}
              </span>
            ) : null}
          </>
        ) : null}

        {item.messageAttachmentCount > 1 ? (
          <span
            className="absolute end-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--shhh-viewer-ink)_52%,transparent)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--shhh-viewer-ivory)] backdrop-blur-sm"
            aria-hidden
          >
            <Images className="size-3" strokeWidth={2.4} />
            {item.messageAttachmentCount}
          </span>
        ) : null}

        {selectable ? (
          <span
            aria-hidden
            className={cn(
              "absolute end-1.5 bottom-1.5 grid size-6 place-items-center rounded-full border-2 transition-all",
              "duration-[var(--shhh-motion-fast)] motion-reduce:transition-none",
              selected
                ? "border-transparent bg-accent text-on-accent scale-100"
                : "border-[color-mix(in_srgb,var(--shhh-viewer-ivory)_85%,transparent)] bg-[color-mix(in_srgb,var(--shhh-viewer-ink)_28%,transparent)] backdrop-blur-sm",
            )}
          >
            {selected ? <Check className="size-3.5" strokeWidth={3} /> : null}
          </span>
        ) : null}
      </button>

      {onToggleFavorite && !selectable ? (
        <button
          type="button"
          data-testid="media-favorite"
          data-media-id={item.id}
          aria-pressed={favorited}
          aria-label={
            favorited ? `Remove ${subject} from favorites` : `Add ${subject} to favorites`
          }
          className={cn(
            "absolute start-1 bottom-1 grid size-9 place-items-center rounded-full",
            "text-[var(--shhh-viewer-ivory)] transition-[opacity,transform] duration-[var(--shhh-motion-normal)]",
            "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-accent-soft)]",
            "active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100",
            // Hover-only on desktop; an existing heart always stays visible.
            showHeart ? "opacity-100" : "opacity-0 group-hover/tile:opacity-100",
          )}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite();
          }}
        >
          <Heart
            className={cn(
              "size-[18px] drop-shadow-[0_1px_3px_rgb(0_0_0_/0.4)]",
              favorited ? "animate-shhh-pop" : "",
            )}
            strokeWidth={2.3}
            fill={showHeart ? "currentColor" : "none"}
            style={showHeart ? { color: "var(--shhh-love)" } : undefined}
          />
          {lovedByBoth ? (
            <span
              aria-hidden
              className="absolute -end-0.5 -top-0.5 size-2.5 rounded-full border border-[color-mix(in_srgb,var(--shhh-viewer-ivory)_80%,transparent)]"
              style={{ background: "var(--shhh-love)" }}
            />
          ) : null}
        </button>
      ) : null}
    </div>
  );
}

/** Skeleton geometry matches MediaTile exactly so nothing shifts on load. */
export function MediaTileSkeleton({ delayMs = 0 }: { delayMs?: number }) {
  return (
    <div
      className="aspect-square w-full animate-shhh-breathe rounded-[1.15rem] bg-[color-mix(in_srgb,var(--shhh-accent-soft)_42%,var(--shhh-bg-soft))] motion-reduce:animate-none"
      style={{ animationDelay: `${delayMs}ms` }}
      aria-hidden
    />
  );
}
