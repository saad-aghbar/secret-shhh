"use client";

import { useId, useState, useTransition } from "react";

import { DoodleUnderline, ShhhButton, ShhhInput, ShhhSurface } from "@/components/shhh";
import { logout } from "@/features/auth/actions";
import { usePrivacy } from "@/features/privacy/privacy-provider";
import { publicEnv } from "@/lib/public-env";
import { cn } from "@/lib/utils";

export function LockScreen() {
  const { unlock } = usePrivacy();
  const passwordId = useId();
  const [password, setPassword] = useState("");
  const [shake, setShake] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await unlock(password);
      if (!result.ok) {
        setMessage(result.error);
        setShake(true);
        window.setTimeout(() => setShake(false), 400);
        setPassword("");
        document.getElementById(passwordId)?.focus();
      }
    });
  }

  return (
    <div
      data-testid="lock-screen"
      className="fixed inset-0 z-[95] flex flex-col px-4"
      style={{
        background: "var(--shhh-bg)",
        paddingTop: "var(--shhh-safe-top)",
        paddingBottom: "var(--shhh-safe-bottom)",
      }}
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
        <header className="mb-8 text-center">
          <p className="font-handmade text-4xl tracking-tight text-primary-text">
            {publicEnv.NEXT_PUBLIC_APP_NAME}
          </p>
          <DoodleUnderline className="mx-auto mt-1 h-2.5 w-24" aria-hidden />
        </header>
        <ShhhSurface
          tone="raised"
          round="lg"
          elevation="soft"
          padding="lg"
          className={cn(shake && "animate-pin-shake")}
        >
          <form onSubmit={onSubmit}>
            <label htmlFor={passwordId} className="block text-sm font-semibold text-primary-text">
              Password
            </label>
            <ShhhInput
              id={passwordId}
              name="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2"
              required
              aria-invalid={Boolean(message)}
            />
            <ShhhButton
              type="submit"
              fullWidth
              size="lg"
              className="mt-4"
              data-testid="unlock-shhh"
              aria-label="Unlock Shhh"
              disabled={pending || password.length < 1}
            >
              {pending ? "Checking…" : "Unlock"}
            </ShhhButton>
            <ShhhButton
              type="button"
              variant="ghost"
              fullWidth
              className="mt-2"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const { clearClientSession } = await import("@/lib/auth/clear-client-session");
                  await clearClientSession();
                  await logout();
                });
              }}
            >
              Sign out
            </ShhhButton>
          </form>
        </ShhhSurface>
        {message ? (
          <p className="mt-6 text-center text-sm text-danger" role="alert">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
