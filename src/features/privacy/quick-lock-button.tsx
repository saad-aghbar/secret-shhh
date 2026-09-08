"use client";

import { Lock } from "lucide-react";

import { ShhhCard } from "@/components/shhh";
import { usePrivacy } from "@/features/privacy/privacy-provider";

export function QuickLockButton() {
  const { lockNow } = usePrivacy();
  return (
    <button
      type="button"
      data-testid="quick-lock"
      aria-label="Lock Shhh"
      onClick={() => void lockNow()}
      className="shhh-press block w-full rounded-[var(--shhh-radius-lg)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)]"
    >
      <ShhhCard>
        <div className="flex items-center gap-3">
          <span className="bg-accent-soft text-accent grid size-11 place-items-center rounded-full">
            <Lock className="size-5" strokeWidth={2} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-primary-text">Lock Shhh</span>
            <span className="mt-0.5 block text-sm text-secondary-text">Hide everything now.</span>
          </span>
        </div>
      </ShhhCard>
    </button>
  );
}
