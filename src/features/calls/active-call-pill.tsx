"use client";

import { Phone } from "lucide-react";

import { useCallSession } from "@/features/calls/call-session-provider";
import { isLiveCallStatus } from "@/lib/calls/config";

export function ActiveCallPill() {
  const session = useCallSession();
  const call = session.call;
  if (!call || !isLiveCallStatus(call.status) || !session.minimized) return null;

  const label =
    call.status === "ringing"
      ? call.role === "callee"
        ? "Incoming call"
        : "Calling…"
      : session.durationLabel
        ? `${call.type === "video" ? "Video call" : "On a call"} · ${session.durationLabel}`
        : call.type === "video"
          ? "Video call"
          : "On a call";

  return (
    <button
      type="button"
      data-testid="active-call-pill"
      aria-label="Return to call"
      onClick={() => session.setMinimized(false)}
      className="shhh-press fixed start-1/2 z-50 flex min-h-11 -translate-x-1/2 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent shadow-[var(--shhh-shadow-float)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)]"
      style={{ bottom: "calc(8.5rem + var(--shhh-safe-bottom))" }}
    >
      <Phone className="size-4" strokeWidth={2.2} />
      <span className="max-w-[12rem] truncate">{session.partnerName}</span>
      <span className="text-on-accent/80">{label}</span>
    </button>
  );
}
