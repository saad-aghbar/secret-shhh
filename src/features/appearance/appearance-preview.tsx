"use client";

import { Heart } from "lucide-react";

import { WallpaperLayer } from "@/features/appearance/wallpaper-layer";
import { ChatDateSeparator } from "@/features/chat/chat-date-separator";
import { ShhhBubble } from "@/components/shhh";
import type { AppearanceTheme, ResolvedAppearance } from "@/lib/appearance/config";
import { cn } from "@/lib/utils";

export type PreviewSeed = {
  incoming: string;
  outgoing: string;
  time: string;
};

export function AppearancePreview({
  resolved,
  imageUrl,
  theme,
  seed,
  partnerName,
}: {
  resolved: ResolvedAppearance;
  imageUrl?: string | null;
  theme: AppearanceTheme;
  seed: PreviewSeed;
  partnerName: string;
}) {
  return (
    <div
      data-testid="appearance-preview"
      data-wallpaper-active={resolved.layer.type === "none" ? undefined : "true"}
      className={cn(
        "relative isolate min-h-[15.5rem] overflow-hidden rounded-[1.7rem] bg-background",
        "shadow-[var(--shhh-shadow-soft)] [clip-path:inset(0_round_1.7rem)] sm:min-h-[22rem]",
      )}
    >
      <WallpaperLayer
        className="rounded-[1.7rem]"
        resolved={resolved}
        imageUrl={imageUrl}
        theme={theme}
      />
      <div className="relative z-[1] flex h-full min-h-[15.5rem] flex-col sm:min-h-[22rem]">
        <div className="border-divider/40 bg-surface-elevated/90 border-b px-4 py-3 backdrop-blur-md">
          <p className="text-primary-text truncate text-sm font-semibold">{partnerName}</p>
          <p className="text-secondary-text text-[11px]">Preview</p>
        </div>
        <div className="flex flex-1 flex-col justify-end gap-2 px-3 pt-2 pb-3">
          <ChatDateSeparator label="Today" />
          <div className="flex flex-col items-start gap-1">
            <ShhhBubble side="incoming" group="single" dir="auto">
              {seed.incoming}
            </ShhhBubble>
            <div className="shhh-message-meta text-muted-text px-1.5 text-[11px]">{seed.time}</div>
            <span className="bg-surface-elevated text-primary-text rounded-pill ms-3 -mt-1 flex items-center gap-1 px-2.5 py-1 text-[14px] shadow-[var(--shhh-shadow-soft)]">
              <Heart className="text-love size-3.5 fill-current" aria-hidden />
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <ShhhBubble side="outgoing" group="single" dir="auto">
              {seed.outgoing}
            </ShhhBubble>
            <div className="shhh-message-meta text-muted-text px-1.5 text-[11px]">
              {seed.time} · Read
            </div>
          </div>
        </div>
        <div className="px-3 pb-3">
          <div
            className={cn(
              "bg-surface-elevated flex items-center rounded-[1.75rem] px-4 py-3 text-sm",
              "text-muted-text shadow-[var(--shhh-shadow-float)]",
            )}
          >
            Message…
          </div>
        </div>
      </div>
    </div>
  );
}
