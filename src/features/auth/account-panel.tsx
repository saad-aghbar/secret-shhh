"use client";

import { useState, useSyncExternalStore, useTransition } from "react";

import { SoftSpark, ShhhAvatar, ShhhButton, ShhhCard, ShhhInput } from "@/components/shhh";
import { changePassword, logout } from "@/features/auth/actions";
import {
  PREFERRED_PROFILE_SLOT_KEY,
  type PreferredSlot,
} from "@/features/auth/preferred-profile";
import { PartnerPresenceBadge } from "@/features/presence/partner-presence-badge";
import type { PartnerPresence } from "@/lib/auth/presence";
import { cn } from "@/lib/utils";

function subscribePreferred(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function readPreferred(): PreferredSlot | null {
  const value = window.localStorage.getItem(PREFERRED_PROFILE_SLOT_KEY);
  if (value === "user_1" || value === "user_2") {
    return value;
  }
  return null;
}

type AccountPanelProps = {
  displayName: string;
  nickname: string | null;
  slot: PreferredSlot | null;
  partnerPresence: PartnerPresence;
};

export function AccountPanel({
  displayName,
  nickname,
  slot,
  partnerPresence,
}: AccountPanelProps) {
  const preferred = useSyncExternalStore(subscribePreferred, readPreferred, () => null);
  const [pending, startTransition] = useTransition();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const isYou = slot != null && preferred === slot;

  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function onChangePassword(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password updated.");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <ShhhCard>
        <div className="flex items-center gap-4">
          <div className="relative">
            <ShhhAvatar initials={initials} size="md" highlighted={isYou} ring={isYou} />
            {isYou ? (
              <SoftSpark className="absolute -right-0.5 -top-0.5 size-3.5 animate-shhh-breathe" aria-hidden />
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-semibold text-primary-text">{displayName}</p>
            {nickname ? <p className="text-sm text-secondary-text">{nickname}</p> : null}
            {isYou ? (
              <p className="mt-1 text-sm text-accent">✓ This is you</p>
            ) : (
              <p className="mt-1 text-sm text-secondary-text">Signed in</p>
            )}
          </div>
        </div>
        <ShhhButton
          type="button"
          variant="secondary"
          fullWidth
          className="mt-5"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const { clearClientSession } = await import("@/lib/auth/clear-client-session");
              await clearClientSession();
              await logout();
            });
          }}
        >
          {pending ? "Signing out…" : "Sign out"}
        </ShhhButton>
      </ShhhCard>

      <PartnerPresenceBadge initial={partnerPresence} variant="card" />

      <ShhhCard
        title="Change password"
        description="Any password is fine — letters, numbers, symbols, any length."
      >
        <form onSubmit={onChangePassword} className="flex flex-col gap-3">
          <div>
            <label htmlFor="current-password" className="text-sm text-secondary-text">
              Current password
            </label>
            <ShhhInput
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="mt-1.5"
              required
            />
          </div>
          <div>
            <label htmlFor="new-password" className="text-sm text-secondary-text">
              New password
            </label>
            <ShhhInput
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="mt-1.5"
              required
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="text-sm text-secondary-text">
              Confirm new password
            </label>
            <ShhhInput
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="mt-1.5"
              required
            />
          </div>
          <ShhhButton type="submit" fullWidth className="mt-1" disabled={pending}>
            {pending ? "Saving…" : "Update password"}
          </ShhhButton>
          {message ? (
            <p
              className={cn("text-sm", success ? "text-success" : "text-danger")}
              role="status"
            >
              {message}
            </p>
          ) : null}
        </form>
      </ShhhCard>
    </div>
  );
}
