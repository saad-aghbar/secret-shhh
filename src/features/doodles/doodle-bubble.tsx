"use client";

import { DoodleArt } from "@/features/doodles/doodle-art";
import { openDoodleViewer } from "@/features/doodles/doodle-viewer-host";
import type { DoodleRef } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

type DoodleBubbleProps = {
  doodle?: DoodleRef | null;
  isOwn: boolean;
  senderName: string;
  timestamp?: string;
};

export function DoodleBubble({ doodle, isOwn, senderName, timestamp }: DoodleBubbleProps) {
  if (!doodle) {
    return (
      <span
        data-testid="doodle-unavailable"
        className="bg-bg-soft text-muted-text rounded-pill px-3.5 py-2 text-[13px] font-medium"
      >
        Couldn&apos;t show this doodle.
      </span>
    );
  }

  return (
    <button
      type="button"
      data-testid="doodle-bubble"
      data-side={isOwn ? "outgoing" : "incoming"}
      aria-label={`Doodle sent by ${senderName}`}
      className={cn(
        "shhh-press w-[min(72vw,17.5rem)] overflow-hidden rounded-[1.45rem]",
        "shadow-[var(--shhh-shadow-soft)]",
      )}
      onClick={() =>
        openDoodleViewer({
          doodle,
          senderName,
          timestamp,
        })
      }
    >
      <div className="aspect-[4/5] w-full">
        <DoodleArt document={doodle.document} label={`Doodle sent by ${senderName}`} />
      </div>
    </button>
  );
}
