"use client";

import { ShhhSpinner } from "@/components/shhh";
import { openChatMediaViewer } from "@/features/chat/chat-media-viewer";
import { ProgressiveImage } from "@/features/chat/progressive-image";
import type { BubbleGroup, ChatMediaItem } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

type PhotoBubbleProps = {
  media: ChatMediaItem[];
  caption?: string;
  progress?: number;
  isOwn?: boolean;
  group?: BubbleGroup;
  senderName: string;
};

function outerRadius(isOwn: boolean, group: BubbleGroup) {
  if (isOwn) {
    if (group === "first") return "rounded-[1.55rem_1.55rem_0.55rem_1.55rem]";
    if (group === "middle") return "rounded-[1.55rem_0.55rem_0.55rem_1.55rem]";
    if (group === "last") return "rounded-[1.55rem_0.55rem_0.55rem_1.55rem]";
    return "rounded-[1.55rem_1.5rem_0.5rem_1.55rem]";
  }
  if (group === "first") return "rounded-[1.55rem_1.55rem_1.55rem_0.55rem]";
  if (group === "middle") return "rounded-[0.55rem_1.55rem_1.55rem_0.55rem]";
  if (group === "last") return "rounded-[0.55rem_1.55rem_1.55rem_0.55rem]";
  return "rounded-[1.55rem_1.55rem_1.55rem_0.5rem]";
}

/** Keep single photos readable — never shrink to caption width (skinny pill). */
function singleFrameAspect(width?: number | null, height?: number | null) {
  const w = width && width > 0 ? width : 4;
  const h = height && height > 0 ? height : 3;
  const ratio = w / h;
  // Clamp between ~3:4 portrait and ~16:10 landscape.
  const clamped = Math.min(1.6, Math.max(0.72, ratio));
  return clamped;
}

export function PhotoBubble({
  media,
  caption,
  progress,
  isOwn,
  group = "single",
  senderName,
}: PhotoBubbleProps) {
  const sorted = [...media].sort((a, b) => a.sortOrder - b.sortOrder);
  const visible = sorted.slice(0, sorted.length >= 4 ? 4 : sorted.length);
  const count = sorted.length;
  const uploading = typeof progress === "number" && progress >= 0 && progress < 100;
  const photoAlt = `Photo sent by ${senderName}`;
  const singleAspect = singleFrameAspect(sorted[0]?.width, sorted[0]?.height);

  return (
    <>
      <div
        data-testid="photo-bubble"
        data-side={isOwn ? "outgoing" : "incoming"}
        className={cn(
          "relative overflow-hidden shadow-[var(--shhh-shadow-soft)]",
          "motion-reduce:transition-none",
          // Explicit width so items-end + short captions cannot collapse into a pill.
          count === 1 ? "w-[min(78vw,18.5rem)]" : "w-[min(85vw,22rem)]",
          isOwn
            ? "bg-[color-mix(in_srgb,var(--shhh-outgoing)_88%,var(--shhh-surface-elevated))]"
            : "bg-[color-mix(in_srgb,var(--shhh-incoming)_92%,var(--shhh-surface-elevated))]",
          outerRadius(Boolean(isOwn), group),
        )}
      >
        {count === 1 ? (
          <button
            type="button"
            aria-label={`Open photo 1 of 1`}
            className="relative w-full overflow-hidden bg-bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            style={{
              aspectRatio: String(singleAspect),
              maxHeight: "min(58vh, 22rem)",
            }}
            onClick={() =>
              openChatMediaViewer({
                media: sorted,
                initialIndex: 0,
                senderName,
                caption,
              })
            }
          >
            <ProgressiveImage
              media={sorted[0]!}
              alt={photoAlt}
              fit="cover"
              className="absolute inset-0"
            />
          </button>
        ) : (
          <div
            className={cn(
              "grid gap-[3px] overflow-hidden bg-[color-mix(in_srgb,var(--shhh-bg)_18%,transparent)]",
              count === 2 && "grid-cols-2",
              count === 3 && "grid-cols-2 grid-rows-2",
              count >= 4 && "grid-cols-2 grid-rows-2",
            )}
          >
            {visible.map((item, index) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Open photo ${index + 1} of ${count}`}
                className={cn(
                  "relative min-h-0 overflow-hidden bg-bg-soft focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  count === 2 && "aspect-[3/4] min-h-44",
                  count === 3 && index === 0 && "row-span-2 min-h-56",
                  count === 3 && index > 0 && "aspect-square",
                  count >= 4 && "aspect-square min-h-28",
                )}
                onClick={() =>
                  openChatMediaViewer({
                    media: sorted,
                    initialIndex: index,
                    senderName,
                    caption,
                  })
                }
              >
                <ProgressiveImage media={item} alt={photoAlt} className="absolute inset-0" />
                {count > 4 && index === 3 ? (
                  <span
                    className="absolute inset-0 grid place-items-center text-2xl font-semibold text-[var(--shhh-bg)]"
                    style={{
                      background: "color-mix(in srgb, var(--shhh-text) 42%, transparent)",
                      backdropFilter: "blur(6px)",
                    }}
                    data-testid="photo-album-more"
                  >
                    +{count - 4}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        )}
        {caption ? (
          <p
            dir="auto"
            className="font-message px-3.5 py-2.5 text-start text-[15px] leading-relaxed text-primary-text [unicode-bidi:plaintext]"
          >
            {caption}
          </p>
        ) : null}
        {uploading ? (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[color-mix(in_srgb,var(--shhh-bg)_28%,transparent)]"
            aria-label={`Sending ${Math.round(progress)}%`}
            data-testid="photo-upload-veil"
          >
            <div className="flex flex-col items-center gap-2 rounded-[1.25rem] bg-[color-mix(in_srgb,var(--shhh-surface-floating)_82%,transparent)] px-4 py-3 shadow-[var(--shhh-shadow-soft)] backdrop-blur-sm">
              <ShhhSpinner className="size-7" label="Sending photo" />
              <span className="text-muted-text text-[11px] font-medium">Sending…</span>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
