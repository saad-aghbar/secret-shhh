"use client";

import { Reply } from "lucide-react";
import type { ReactNode } from "react";

import { SWIPE_THRESHOLD_PX } from "@/lib/gestures/message-gesture";
import { cn } from "@/lib/utils";

type SwipeToReplyProps = {
  offset: number;
  children: ReactNode;
};

export function SwipeToReply({ offset, children }: SwipeToReplyProps) {
  const armed = offset >= SWIPE_THRESHOLD_PX;
  const iconOpacity = Math.min(1, offset / SWIPE_THRESHOLD_PX);
  return (
    <div className="relative w-fit max-w-full touch-pan-y" data-testid="swipe-to-reply">
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-2 flex items-center",
          armed ? "text-accent" : "text-muted-text",
        )}
        style={{ opacity: iconOpacity, transform: `scale(${0.8 + iconOpacity * 0.2})` }}
      >
        <span className="bg-accent-soft grid size-8 place-items-center rounded-full">
          <Reply className="size-4" strokeWidth={2.2} />
        </span>
      </div>
      <div
        className="will-change-transform motion-reduce:transition-none"
        style={{ transform: offset ? `translateX(${offset}px)` : undefined }}
        data-swipe-offset={offset}
        data-swipe-armed={armed ? "true" : "false"}
      >
        {children}
      </div>
    </div>
  );
}
