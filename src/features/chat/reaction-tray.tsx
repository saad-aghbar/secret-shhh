"use client";

import { SmilePlus } from "lucide-react";
import { useState } from "react";

import { ReactionEmojiInput } from "@/features/chat/reaction-emoji-input";
import { reactionAriaLabel } from "@/lib/chat/message-actions";
import { QUICK_REACTIONS } from "@/lib/emoji";
import { cn } from "@/lib/utils";

type ReactionTrayProps = {
  selected?: string | null;
  onPick: (emoji: string) => void;
  onClose: () => void;
  picking?: boolean;
};

export function ReactionTray({ selected, onPick, onClose, picking: pickingProp }: ReactionTrayProps) {
  const [pickingLocal, setPicking] = useState(false);
  const picking = pickingProp === true || pickingLocal;

  return (
    <div
      role="toolbar"
      aria-label="Reactions"
      data-testid="reaction-tray"
      className="animate-shhh-settle flex items-center gap-1 rounded-pill bg-surface-elevated px-1.5 py-1 shadow-[var(--shhh-shadow-float)] motion-reduce:animate-none"
    >
      {picking ? (
        <ReactionEmojiInput onPick={onPick} onCancel={() => setPicking(false)} />
      ) : (
        <>
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={reactionAriaLabel(emoji)}
              aria-pressed={selected === emoji}
              data-testid={`react-${emoji}`}
              className={cn(
                "shhh-press grid size-10 place-items-center rounded-full text-[1.25rem] sm:size-11 sm:text-[1.35rem]",
                selected === emoji ? "bg-love-soft" : "hover:bg-bg-soft",
              )}
              ref={(node) => {
                if (node) node.onclick = () => onPick(emoji);
              }}
              onClick={() => onPick(emoji)}
            >
              {emoji}
            </button>
          ))}
          <button
            type="button"
            aria-label="Pick any emoji"
            data-testid="react-more"
            className="shhh-press text-secondary-text hover:bg-bg-soft grid size-10 place-items-center rounded-full sm:size-11"
            ref={(node) => {
              if (node) node.onclick = () => setPicking(true);
            }}
            onClick={() => setPicking(true)}
          >
            <SmilePlus className="size-5" strokeWidth={2} />
          </button>
        </>
      )}
      <span className="sr-only">
        <button type="button" onClick={onClose}>
          Close reactions
        </button>
      </span>
    </div>
  );
}
