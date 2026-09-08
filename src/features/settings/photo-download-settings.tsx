"use client";

import { useEffect, useState } from "react";

import { ShhhToggle } from "@/components/shhh";
import {
  invalidatePhotoDownloadPreferences,
  type PhotoDownloadPreferences,
} from "@/lib/media/download-policy";
import { cn } from "@/lib/utils";

type AutoDownload = "always" | "good_connection" | "never";
type Preferences = PhotoDownloadPreferences;

export function PhotoDownloadSettings() {
  const [preferences, setPreferences] = useState<Preferences>({
    autoDownloadPhotos: "good_connection",
    lowDataMode: false,
  });
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/preferences", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Preferences unavailable");
        return response.json() as Promise<Preferences>;
      })
      .then((value) => {
        if (active) setPreferences(value);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  async function update(patch: Partial<Preferences>) {
    const previous = preferences;
    const next = { ...preferences, ...patch };
    setPreferences(next);
    setSaving(true);
    try {
      const response = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error("Couldn't save preferences");
      const saved = (await response.json()) as Preferences;
      setPreferences(saved);
      invalidatePhotoDownloadPreferences(saved);
    } catch {
      setPreferences(previous);
    } finally {
      setSaving(false);
    }
  }

  if (!ready) {
    return (
      <div
        className="h-24 animate-pulse rounded-[1.5rem] bg-bg-soft"
        aria-label="Loading photo preferences"
      />
    );
  }

  return (
    <div className="space-y-5" aria-busy={saving} data-testid="photo-download-settings">
      <div>
        <p className="mb-2 text-sm font-semibold text-primary-text">When to load photos</p>
        <p className="text-secondary-text mb-3 text-xs leading-relaxed">
          Choose when Shhh loads full photo previews in chat. Videos never download
          automatically — they stream when you play them.
        </p>
        <ShhhToggle
          label="Automatic photo downloads"
          value={preferences.autoDownloadPhotos}
          options={[
            { value: "always", label: "Always" },
            { value: "good_connection", label: "When connection looks good" },
            { value: "never", label: "Never automatically" },
          ]}
          className="[&_button]:px-1 [&_button]:text-xs sm:[&_button]:text-sm"
          onChange={(value) => void update({ autoDownloadPhotos: value as AutoDownload })}
        />
      </div>
      <div className="flex min-h-12 items-center justify-between gap-4 rounded-[1.35rem] bg-bg-soft px-4 py-3">
        <div>
          <p className="font-semibold text-primary-text">Low data mode</p>
          <p className="text-sm text-secondary-text">
            Smaller photo previews first. Videos only load a poster until you play them.
            Calls stay on audio-first quality.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={preferences.lowDataMode}
          aria-label="Low data mode"
          onClick={() => void update({ lowDataMode: !preferences.lowDataMode })}
          className={cn(
            "shhh-press relative h-8 w-14 shrink-0 rounded-full p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)]",
            preferences.lowDataMode ? "bg-accent" : "bg-[var(--shhh-border-soft)]",
          )}
        >
          <span
            className={cn(
              "block size-6 rounded-full bg-surface-elevated shadow-[var(--shhh-shadow-soft)] transition-transform motion-reduce:transition-none",
              preferences.lowDataMode && "translate-x-6",
            )}
          />
        </button>
      </div>
    </div>
  );
}
