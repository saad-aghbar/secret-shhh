"use client";

export type PhotoDownloadPreferences = {
  autoDownloadPhotos: "always" | "good_connection" | "never";
  lowDataMode: boolean;
  voicePlaybackRate?: "1" | "1.5" | "2";
};

let cached: PhotoDownloadPreferences | null = null;
let pending: Promise<PhotoDownloadPreferences> | null = null;

export function invalidatePhotoDownloadPreferences(value?: PhotoDownloadPreferences) {
  cached = value ?? null;
  pending = null;
}

export async function getPhotoDownloadPreferences() {
  if (cached) return cached;
  if (pending) return pending;
  pending = fetch("/api/preferences", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error("Preferences unavailable");
      return (await response.json()) as PhotoDownloadPreferences;
    })
    .catch((): PhotoDownloadPreferences => ({
      autoDownloadPhotos: "good_connection",
      lowDataMode: false,
      voicePlaybackRate: "1",
    }))
    .then((preferences) => {
      cached = preferences;
      return preferences;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

export async function shouldAutoLoadPhotoPreview() {
  const preferences = await getPhotoDownloadPreferences();
  if (preferences.lowDataMode || preferences.autoDownloadPhotos === "never") return false;
  if (preferences.autoDownloadPhotos === "always") return true;

  const connection = (
    navigator as Navigator & {
      connection?: { effectiveType?: string; saveData?: boolean };
    }
  ).connection;
  if (connection?.saveData) return false;
  return connection?.effectiveType !== "slow-2g" && connection?.effectiveType !== "2g";
}

/** Videos never auto-download the original; stream via <video src> instead. */
export async function videoPreloadMode(): Promise<"metadata" | "none"> {
  const preferences = await getPhotoDownloadPreferences();
  if (preferences.lowDataMode) return "none";
  return "metadata";
}
