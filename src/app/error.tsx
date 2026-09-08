"use client";

import { useEffect } from "react";

import { hardReloadApp } from "@/lib/pwa/hard-reload";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    // Keep the real error in the console only — never show it in the UI.
  }, []);

  return (
    <div className="grid min-h-[50dvh] place-items-center px-6 py-12 text-center">
      <div>
        <h1 className="text-xl font-semibold text-primary-text">Something went wrong</h1>
        <p className="mt-2 text-sm text-secondary-text">Try again, or go back to Chat.</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            className="bg-button text-on-button inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold"
            onClick={() => (reset ? reset() : void hardReloadApp())}
          >
            Try again
          </button>
          <a
            href="/chat"
            className="inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold text-accent"
          >
            Go to Chat
          </a>
        </div>
      </div>
    </div>
  );
}
