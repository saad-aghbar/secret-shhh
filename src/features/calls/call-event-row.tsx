"use client";

import { Phone } from "lucide-react";

import { useCallSessionOptional } from "@/features/calls/call-session-provider";
import { callAgainLabel, callEventTitle, parseCallEventMeta } from "@/lib/calls/events";
import type { ChatMessage } from "@/lib/chat/types";

export function CallEventRow({ message }: { message: ChatMessage }) {
  const session = useCallSessionOptional();
  const meta = message.call ?? parseCallEventMeta(null);
  const title = meta ? callEventTitle(meta) : message.textContent || "Call";
  const type = meta?.callType ?? "audio";

  return (
    <div
      className="flex flex-col items-center px-4 py-3"
      data-testid="call-event-row"
      data-message-id={message.id}
    >
      <div className="flex max-w-full items-center gap-2 rounded-full bg-bg-soft px-3 py-1.5 text-xs font-semibold text-secondary-text">
        <Phone className="size-3.5" strokeWidth={2.2} aria-hidden />
        <span className="truncate">{title}</span>
      </div>
      {session ? (
        <button
          type="button"
          className="mt-2 min-h-11 px-3 text-sm font-semibold text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)]"
          data-testid="call-again"
          onClick={() => void session.startCall(type)}
        >
          {callAgainLabel(type)}
        </button>
      ) : null}
    </div>
  );
}
