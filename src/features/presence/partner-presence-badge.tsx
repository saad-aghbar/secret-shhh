"use client";

import { useEffect, useState, useTransition } from "react";

import { ShhhBadge, ShhhCard } from "@/components/shhh";
import { fetchPartnerPresence } from "@/features/presence/actions";
import type { PartnerPresence, PresenceStatus } from "@/lib/auth/presence";

type PartnerPresenceBadgeProps = {
  initial: PartnerPresence;
  /** compact = chat header line; card = settings block */
  variant?: "compact" | "card";
};

function labelFor(status: PresenceStatus, name: string) {
  if (status === "unknown") {
    return `${name} hasn’t joined yet`;
  }
  return `${name} · ${
    status === "online" ? "Online" : status === "recently_active" ? "Recently active" : "Offline"
  }`;
}

function toneFor(status: PresenceStatus) {
  if (status === "online") return "success" as const;
  if (status === "recently_active") return "accent" as const;
  if (status === "unknown") return "neutral" as const;
  return "neutral" as const;
}

export function PartnerPresenceBadge({
  initial,
  variant = "compact",
}: PartnerPresenceBadgeProps) {
  const [presence, setPresence] = useState(initial);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const id = window.setInterval(() => {
      startTransition(async () => {
        const next = await fetchPartnerPresence();
        if (next) {
          setPresence(next);
        }
      });
    }, 15_000);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        startTransition(async () => {
          const next = await fetchPartnerPresence();
          if (next) {
            setPresence(next);
          }
        });
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const online = presence.status === "online";

  if (variant === "card") {
    return (
      <ShhhCard title="Presence">
        <div className="flex items-center gap-3">
          <span
            className={
              online
                ? "size-2.5 shrink-0 rounded-full bg-success"
                : "size-2.5 shrink-0 rounded-full bg-secondary-text/40"
            }
            aria-hidden
          />
          <div className="min-w-0">
            <p className="font-medium text-primary-text">{presence.displayName}</p>
            <p className="text-sm text-secondary-text">
              {presence.status === "online"
                ? "Online"
                : presence.status === "recently_active"
                  ? "Recently active"
                  : presence.status === "unknown"
                    ? "Not joined yet"
                    : "Offline"}
            </p>
          </div>
        </div>
      </ShhhCard>
    );
  }

  return (
    <ShhhBadge
      label={labelFor(presence.status, presence.displayName)}
      tone={toneFor(presence.status)}
      aria-live="polite"
    />
  );
}
