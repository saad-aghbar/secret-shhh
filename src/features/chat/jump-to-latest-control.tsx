"use client";

import { ArrowDown } from "lucide-react";

import { ShhhSurface } from "@/components/shhh";
import { cn } from "@/lib/utils";

type JumpToLatestControlProps = {
  /** False when near bottom — control hides via presence. */
  visible: boolean;
  /** Partner unseen count while scrolled up. */
  unseen: number;
  onClick: () => void;
};

function labelFor(unseen: number) {
  if (unseen <= 0) {
    return { text: null as string | null, aria: "Scroll to latest message" };
  }
  if (unseen === 1) {
    return { text: "1 new message ↓", aria: "Scroll to 1 new message" };
  }
  return {
    text: `${unseen} new messages ↓`,
    aria: `Scroll to ${unseen} new messages`,
  };
}

/**
 * ONE smart floating control:
 * State A — ↓ (away from bottom, no unseen)
 * State B — N new message(s) ↓ (away + partner arrivals)
 * Same DOM control; transforms in place. Never two overlapping buttons.
 */
export function JumpToLatestControl({ visible, unseen, onClick }: JumpToLatestControlProps) {
  const { text, aria } = labelFor(unseen);
  const isPill = unseen > 0;

  return (
    <div
      className={cn(
        "shhh-presence pointer-events-none absolute inset-x-0 bottom-[4.75rem] z-10 flex justify-end px-3",
      )}
      data-active={visible ? "true" : "false"}
      data-testid="jump-to-latest-wrap"
    >
      <button
        type="button"
        className={cn(
          "shhh-press shhh-jump-control pointer-events-auto min-h-11",
          isPill ? "min-w-0" : "min-w-11",
        )}
        onClick={onClick}
        aria-label={aria}
        data-testid="jump-to-latest"
        data-state={isPill ? "unseen" : "arrow"}
        tabIndex={visible ? 0 : -1}
      >
        <ShhhSurface
          tone="floating"
          round="pill"
          elevation="float"
          padding="none"
          className={cn(
            "flex items-center justify-center gap-1.5 text-xs font-medium text-accent",
            "bg-[color-mix(in_srgb,var(--shhh-surface-floating)_88%,transparent)]",
            "backdrop-blur-[var(--shhh-blur)]",
            isPill ? "px-3.5 py-2" : "size-11",
          )}
        >
          {isPill ? (
            <span className="whitespace-nowrap">{text}</span>
          ) : (
            <ArrowDown className="size-5" strokeWidth={2.2} aria-hidden />
          )}
        </ShhhSurface>
      </button>
    </div>
  );
}
