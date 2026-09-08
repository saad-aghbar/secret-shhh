"use client";

import { StickerImage } from "@/features/stickers/sticker-image";
import type { StickerRef } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

type StickerBubbleProps = {
  sticker?: StickerRef | null;
  isOwn: boolean;
};

function clampAspect(width: number, height: number) {
  if (!width || !height) return 1;
  return Math.min(1.55, Math.max(0.62, width / height));
}

export function StickerBubble({ sticker, isOwn }: StickerBubbleProps) {
  if (!sticker) {
    return (
      <span
        data-testid="sticker-unavailable"
        className="bg-bg-soft text-muted-text rounded-pill px-3.5 py-2 text-[13px] font-medium"
      >
        Sticker unavailable
      </span>
    );
  }

  const aspect = clampAspect(sticker.width, sticker.height);

  return (
    <div
      data-testid="sticker-bubble"
      data-side={isOwn ? "outgoing" : "incoming"}
      className={cn(
        "sticker-art w-[min(42vw,9.5rem)] md:w-[11rem]",
        "drop-shadow-[0_10px_18px_color-mix(in_srgb,var(--shhh-text)_14%,transparent)]",
      )}
      style={{ aspectRatio: `${aspect}` }}
    >
      <StickerImage
        stickerId={sticker.id}
        name={sticker.name}
        animated={sticker.animated}
        className="size-full"
        priority
      />
    </div>
  );
}
