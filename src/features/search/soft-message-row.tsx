"use client";

import { useState, type ReactNode } from "react";

import { formatChatDateLabel, formatMessageTime } from "@/lib/chat/layout";
import { cn } from "@/lib/utils";

type SoftMessageRowProps = {
  senderLabel: string;
  createdAt: string;
  children: ReactNode;
  onActivate: () => void;
  testId?: string;
  messageId?: string;
  /** Show date · time (search) vs time only (history day list). */
  showDate?: boolean;
};

/**
 * Soft list row for Search results + History day previews.
 * Phone-first: light inset bubble, not stacked elevated cards.
 */
export function SoftMessageRow({
  senderLabel,
  createdAt,
  children,
  onActivate,
  testId,
  messageId,
  showDate = true,
}: SoftMessageRowProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <button
      type="button"
      data-testid={testId}
      data-message-id={messageId}
      className="shhh-press w-full text-start"
      onClick={() => {
        setPressed(true);
        window.setTimeout(() => onActivate(), 90);
      }}
    >
      <div
        className={cn(
          "bg-bg-soft/90 rounded-[1.25rem] px-3.5 py-2.5 md:rounded-[1.35rem] md:px-4 md:py-3",
          "transition-[background-color,transform] duration-[var(--shhh-motion-normal)] ease-[var(--shhh-ease-settle)]",
          pressed && "bg-accent-soft/55",
        )}
      >
        <div
          dir="ltr"
          className="text-secondary-text mb-1 flex items-baseline justify-between gap-2 text-[11px] md:text-xs"
        >
          <span className="text-primary-text font-medium">{senderLabel}</span>
          <span>
            {showDate ? `${formatChatDateLabel(createdAt)} · ` : null}
            {formatMessageTime(createdAt)}
          </span>
        </div>
        <div
          dir="auto"
          className="font-message text-primary-text text-sm leading-relaxed [unicode-bidi:plaintext]"
        >
          {children}
        </div>
      </div>
    </button>
  );
}

export function SoftMessageHighlight({
  snippet,
  matchStart,
  matchEnd,
}: {
  snippet: string;
  matchStart: number | null;
  matchEnd: number | null;
}) {
  if (matchStart == null || matchEnd == null || matchStart < 0 || matchEnd <= matchStart) {
    return <>{snippet}</>;
  }
  return (
    <>
      {snippet.slice(0, matchStart)}
      <mark className="rounded-sm bg-[color-mix(in_srgb,var(--shhh-accent-soft)_88%,transparent)] text-inherit">
        {snippet.slice(matchStart, matchEnd)}
      </mark>
      {snippet.slice(matchEnd)}
    </>
  );
}
