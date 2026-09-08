"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";

import {
  DoodleUnderline,
  SoftSpark,
  ShhhAvatar,
  ShhhButton,
  ShhhInput,
  ShhhSurface,
} from "@/components/shhh";
import { loginWithPassword } from "@/features/auth/actions";
import {
  PREFERRED_PROFILE_SLOT_KEY,
  writePreferredProfileSlot,
  type PreferredSlot,
} from "@/features/auth/preferred-profile";
import { cn } from "@/lib/utils";

type IdentityCard = {
  slot: PreferredSlot;
  displayName: string;
  initials: string;
};

type LoginExperienceProps = {
  cards: IdentityCard[];
  appName: string;
  errorCode?: string | null;
};

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

function messageFromErrorCode(errorCode?: string | null) {
  if (errorCode === "unauthorized") {
    return "That account isn’t allowed here.";
  }
  return null;
}

export function LoginExperience({ cards, appName, errorCode }: LoginExperienceProps) {
  const router = useRouter();
  const preferred = useSyncExternalStore(subscribePreferred, readPreferred, () => null);
  const [step, setStep] = useState<"pick" | "password">("pick");
  const [selected, setSelected] = useState<IdentityCard | null>(null);
  const [password, setPassword] = useState("");
  const [shake, setShake] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const message = actionMessage ?? messageFromErrorCode(errorCode);

  function onSelect(card: IdentityCard) {
    setSelected(card);
    setPassword("");
    setActionMessage(null);
    setStep("password");
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) {
      return;
    }
    setActionMessage(null);
    startTransition(async () => {
      const result = await loginWithPassword({
        slot: selected.slot,
        password,
      });
      if (!result.ok) {
        setActionMessage(result.error);
        setShake(true);
        window.setTimeout(() => setShake(false), 400);
        setPassword("");
        return;
      }
      writePreferredProfileSlot(selected.slot);
      router.replace("/chat");
      router.refresh();
    });
  }

  return (
    <div
      className="relative flex min-h-dvh flex-col px-4"
      style={{
        paddingTop: "var(--shhh-safe-top)",
        paddingBottom: "var(--shhh-safe-bottom)",
        background: "var(--shhh-wallpaper)",
      }}
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
        <header className="mb-8 text-center">
          <p className="font-handmade text-4xl tracking-tight text-primary-text">{appName}</p>
          <DoodleUnderline className="mx-auto mt-1 h-2.5 w-24" aria-hidden />
          <h1
            className={cn(
              "mt-5 text-2xl text-primary-text",
              step === "pick" ? "font-handmade" : "font-bold",
            )}
          >
            {step === "pick" ? "Who’s here?" : `Hi ${selected?.displayName}`}
          </h1>
          <p className="mt-2 text-sm text-secondary-text">
            {step === "pick" ? "Choose your profile to continue." : "Enter your password"}
          </p>
        </header>

        {step === "pick" ? (
          <div className="grid gap-3">
            {cards.map((card) => {
              const isYou = preferred === card.slot;
              return (
                <button
                  key={card.slot}
                  type="button"
                  disabled={pending}
                  onClick={() => onSelect(card)}
                  className={cn(
                    "shhh-press text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    "disabled:opacity-70",
                  )}
                >
                  <ShhhSurface
                    tone="raised"
                    round="lg"
                    elevation="soft"
                    padding="md"
                    className={cn(
                      "flex items-center gap-4 transition hover:-translate-y-0.5",
                      isYou && "ring-2 ring-accent/25",
                    )}
                  >
                    <div className="relative">
                      <ShhhAvatar
                        initials={card.initials}
                        size="lg"
                        highlighted={isYou}
                        ring={isYou}
                      />
                      {isYou ? (
                        <SoftSpark
                          className="absolute -right-1 -top-1 size-3.5 animate-shhh-breathe"
                          aria-hidden
                        />
                      ) : null}
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xl font-bold text-primary-text">
                        {card.displayName}
                      </span>
                      {isYou ? (
                        <span className="mt-1 block text-sm text-accent">✓ This is you</span>
                      ) : (
                        <span className="mt-1 block text-sm text-secondary-text">
                          Tap to sign in
                        </span>
                      )}
                    </span>
                  </ShhhSurface>
                </button>
              );
            })}
          </div>
        ) : (
          <ShhhSurface
            tone="raised"
            round="lg"
            elevation="soft"
            padding="lg"
            className={cn(shake && "animate-pin-shake")}
          >
            <form onSubmit={onSubmit}>
              <label htmlFor="password" className="block text-sm font-semibold text-primary-text">
                Password
              </label>
              <ShhhInput
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2"
                required
                aria-invalid={Boolean(actionMessage)}
              />
              <ShhhButton
                type="submit"
                fullWidth
                size="lg"
                className="mt-4"
                disabled={pending || password.length < 1}
              >
                {pending ? "Checking…" : "Continue"}
              </ShhhButton>
              <ShhhButton
                type="button"
                variant="ghost"
                fullWidth
                className="mt-2"
                disabled={pending}
                onClick={() => {
                  setStep("pick");
                  setPassword("");
                  setActionMessage(null);
                }}
              >
                Back
              </ShhhButton>
            </form>
          </ShhhSurface>
        )}

        {message ? (
          <p className="mt-6 text-center text-sm text-danger" role="alert">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
