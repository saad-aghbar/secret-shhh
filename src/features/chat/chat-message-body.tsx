"use client";

import { isSafeHttpUrl, splitTextLinks } from "@/lib/text/links";

type ChatMessageBodyProps = {
  text: string;
};

/**
 * Untrusted text. dir=auto + plaintext isolation so Arabic/English mix
 * follows Unicode bidi. Bubble side is independent (set by the parent).
 */
export function ChatMessageBody({ text }: ChatMessageBodyProps) {
  const parts = splitTextLinks(text);

  return (
    <p
      dir="auto"
      className="font-message text-start break-words whitespace-pre-wrap [overflow-wrap:break-word] [unicode-bidi:plaintext]"
    >
      {parts.map((part, index) => {
        if (part.kind === "url" && isSafeHttpUrl(part.value)) {
          return (
            <a
              key={`${part.value}-${index}`}
              href={part.value}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-accent/50 underline-offset-2"
            >
              {part.value}
            </a>
          );
        }
        return <span key={`t-${index}`}>{part.value}</span>;
      })}
    </p>
  );
}
