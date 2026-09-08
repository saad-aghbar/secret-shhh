"use client";

import { ShhhBubble } from "@/components/shhh/shhh-bubble";

type TypingIndicatorProps = {
  name: string;
  active: boolean;
};

/**
 * Compact incoming bubble with dots — theme fill via ShhhBubble, no full-width bar.
 * Presence via data-active so exit can fade without a hard unmount snap.
 */
export function TypingIndicator({ name, active }: TypingIndicatorProps) {
  return (
    <div
      className="shhh-presence flex justify-start px-4 pb-2"
      data-testid="typing-indicator"
      data-active={active ? "true" : "false"}
      aria-hidden={!active}
    >
      <ShhhBubble
        side="incoming"
        group="single"
        className="w-fit px-3.5 py-2.5"
        aria-live="polite"
      >
        <span className="sr-only">{active ? `${name} is typing…` : ""}</span>
        <span className="flex items-center gap-1" aria-hidden>
          <span className="animate-shhh-typing-dot size-1.5 rounded-full bg-secondary-text" />
          <span
            className="animate-shhh-typing-dot size-1.5 rounded-full bg-secondary-text"
            style={{ animationDelay: "0.12s" }}
          />
          <span
            className="animate-shhh-typing-dot size-1.5 rounded-full bg-secondary-text"
            style={{ animationDelay: "0.24s" }}
          />
        </span>
      </ShhhBubble>
    </div>
  );
}
