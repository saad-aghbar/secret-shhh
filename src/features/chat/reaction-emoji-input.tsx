"use client";

import { useEffect, useRef, useState } from "react";

import { firstGrapheme, parseReactionEmoji } from "@/lib/emoji";
import { cn } from "@/lib/utils";

type ReactionEmojiInputProps = {
  onPick: (emoji: string) => void;
  onCancel: () => void;
};

export function ReactionEmojiInput({ onPick, onCancel }: ReactionEmojiInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    const node = ref.current;
    node?.focus();
    return () => node?.blur();
  }, []);

  return (
    <div className="flex min-w-[7.5rem] items-center gap-2 px-1" data-testid="reaction-emoji-input">
      <input
        ref={ref}
        aria-label="Pick any emoji"
        enterKeyHint="done"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        className={cn(
          "font-message w-16 bg-transparent text-center text-xl outline-none",
          "placeholder:text-muted-text",
        )}
        placeholder="♡"
        onChange={(event) => {
          const raw = event.target.value;
          const emoji = parseReactionEmoji(raw);
          if (emoji) {
            onPick(emoji);
            event.target.value = "";
            setHint(false);
            return;
          }
          if (raw && !parseReactionEmoji(firstGrapheme(raw))) {
            event.target.value = "";
            setHint(true);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
        onBlur={() => {
          window.setTimeout(onCancel, 80);
        }}
      />
      {hint ? <span className="text-muted-text text-[11px]">Pick one emoji</span> : null}
    </div>
  );
}
