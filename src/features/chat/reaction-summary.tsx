"use client";

import { summarizeReactions } from "@/lib/chat/message-actions";
import type { MessageReaction } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

type ReactionSummaryProps = {
  reactions?: MessageReaction[];
  userId: string;
  partnerName: string;
  selfName: string;
  isOwn: boolean;
  onOpen?: () => void;
};

export function ReactionSummary({
  reactions,
  userId,
  partnerName,
  selfName,
  isOwn,
  onOpen,
}: ReactionSummaryProps) {
  const items = summarizeReactions(reactions, userId);
  if (items.length === 0) return null;

  const who =
    reactions
      ?.map((item) => `${item.userId === userId ? selfName : partnerName} ${item.emoji}`)
      .join(", ") ?? "";

  return (
    <button
      type="button"
      data-testid="reaction-summary"
      data-message-gesture-ignore
      aria-label={who}
      onClick={onOpen}
      className={cn(
        "animate-shhh-pop bg-surface-elevated text-primary-text relative z-[1] -mt-1.5 flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[14px] shadow-[var(--shhh-shadow-soft)] motion-reduce:animate-none",
        isOwn ? "me-3 self-end" : "ms-3 self-start",
      )}
    >
      {items.map((item) => (
        <span key={item.emoji} data-mine={item.mine ? "true" : undefined}>
          {item.emoji}
          {item.count > 1 ? <span className="text-muted-text ms-1 text-[12px]">{item.count}</span> : null}
        </span>
      ))}
    </button>
  );
}
