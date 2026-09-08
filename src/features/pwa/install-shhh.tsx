"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

import { ShhhButton, ShhhCard } from "@/components/shhh";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || Boolean(nav.standalone);
}

function isIosSafari() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
}

export function InstallShhh() {
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- feature-detect install state once on mount */
    setInstalled(isStandalone());
    setIos(isIosSafari());
    /* eslint-enable react-hooks/set-state-in-effect */
    function onPrompt(event: Event) {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (installed) {
    return null;
  }

  return (
    <ShhhCard data-testid="install-shhh">
      <div className="flex items-start gap-3">
        <span className="bg-accent-soft text-accent grid size-11 place-items-center rounded-full">
          <Download className="size-5" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-primary-text">Install Shhh</p>
          {ios ? (
            <p className="mt-1 text-sm leading-relaxed text-secondary-text">
              On iPhone, tap Share, then Add to Home Screen.
            </p>
          ) : promptEvent ? (
            <p className="mt-1 text-sm leading-relaxed text-secondary-text">
              Add Shhh to your home screen or desktop.
            </p>
          ) : (
            <p className="mt-1 text-sm leading-relaxed text-secondary-text">
              Your browser can add Shhh from its menu when install is available.
            </p>
          )}
          {promptEvent ? (
            <ShhhButton
              type="button"
              className="mt-3"
              aria-label="Install Shhh"
              onClick={async () => {
                await promptEvent.prompt();
                const choice = await promptEvent.userChoice;
                if (choice.outcome === "accepted") {
                  setInstalled(true);
                }
                setPromptEvent(null);
              }}
            >
              Install Shhh
            </ShhhButton>
          ) : null}
        </div>
      </div>
    </ShhhCard>
  );
}
