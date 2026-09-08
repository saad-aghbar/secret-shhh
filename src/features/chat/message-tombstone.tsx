"use client";

import { Ban } from "lucide-react";

import { cn } from "@/lib/utils";

export function MessageTombstone({ isOwn }: { isOwn: boolean }) {
  return (
    <div
      data-testid="message-tombstone"
      className={cn(
        "text-muted-text flex max-w-[85%] items-center gap-1.5 rounded-[1.35rem] px-3.5 py-2 text-[13px] italic",
      )}
      style={{
        background: isOwn
          ? "color-mix(in srgb, var(--shhh-outgoing) calc(var(--shhh-wallpaper-tombstone-own) * 100%), transparent)"
          : "color-mix(in srgb, var(--shhh-incoming) calc(var(--shhh-wallpaper-tombstone-theirs) * 100%), transparent)",
      }}
    >
      <Ban className="size-3.5 shrink-0 opacity-70" strokeWidth={2} aria-hidden />
      Message deleted
    </div>
  );
}
