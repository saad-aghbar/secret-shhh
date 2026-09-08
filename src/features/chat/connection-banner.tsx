"use client";

import { ShhhSurface } from "@/components/shhh";
import type { ConnectionState } from "@/lib/connection/manager";

export function ConnectionBanner({ state }: { state: ConnectionState }) {
  if (state === "online") {
    return null;
  }

  const label =
    state === "offline"
      ? "Connection lost. Messages will send when you’re back online."
      : state === "reconnecting"
        ? "Reconnecting…"
        : "Connection is slow. Messages may take a moment.";

  return (
    <div className="flex justify-center px-4 py-2">
      <ShhhSurface
        tone="floating"
        round="pill"
        elevation="soft"
        padding="none"
        className="max-w-[92%] px-3 py-1.5 text-center text-xs text-secondary-text"
        role="status"
      >
        {label}
      </ShhhSurface>
    </div>
  );
}
