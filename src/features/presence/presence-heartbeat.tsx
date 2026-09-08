"use client";

import { useEffect } from "react";

import { sendPresenceHeartbeat } from "@/features/presence/actions";

const HEARTBEAT_MS = 20_000;

/**
 * Keeps the current user's session lastSeenAt fresh while the app is open.
 */
export function PresenceHeartbeat() {
  useEffect(() => {
    let cancelled = false;

    async function beat() {
      if (cancelled || document.visibilityState === "hidden") {
        return;
      }
      await sendPresenceHeartbeat().catch(() => undefined);
    }

    void beat();
    const id = window.setInterval(() => {
      void beat();
    }, HEARTBEAT_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void beat();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
