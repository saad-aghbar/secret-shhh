import type { WallpaperConfig } from "@/lib/appearance/config";
import { parseWallpaperConfigLoose } from "@/lib/appearance/validation";
import { APPEARANCE_DRAFT_MAX_AGE_MS, APPEARANCE_DRAFT_STORAGE_KEY } from "@/lib/appearance/limits";

export type AppearanceMode = "personal" | "shared";

export type AppearanceDraftStore = {
  userId?: string;
  personal?: WallpaperConfig;
  shared?: WallpaperConfig;
  mode: AppearanceMode;
  savedAt: number;
};

function readRaw(): AppearanceDraftStore | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(APPEARANCE_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppearanceDraftStore;
    if (!parsed || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > APPEARANCE_DRAFT_MAX_AGE_MS) {
      window.localStorage.removeItem(APPEARANCE_DRAFT_STORAGE_KEY);
      return null;
    }
    return {
      userId: typeof parsed.userId === "string" ? parsed.userId : undefined,
      mode: parsed.mode === "shared" ? "shared" : "personal",
      savedAt: parsed.savedAt,
      personal: parsed.personal ? (parseWallpaperConfigLoose(parsed.personal) ?? undefined) : undefined,
      shared: parsed.shared ? (parseWallpaperConfigLoose(parsed.shared) ?? undefined) : undefined,
    };
  } catch {
    return null;
  }
}

export function readAppearanceDraft(userId?: string): AppearanceDraftStore | null {
  const stored = readRaw();
  if (!stored) return null;
  if (userId && stored.userId && stored.userId !== userId) return null;
  return stored;
}

export function writeAppearanceDraft(store: AppearanceDraftStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    APPEARANCE_DRAFT_STORAGE_KEY,
    JSON.stringify({ ...store, savedAt: Date.now() }),
  );
}

export function clearAppearanceDraft() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(APPEARANCE_DRAFT_STORAGE_KEY);
  for (const key of Object.keys(window.localStorage)) {
    if (key.startsWith(`${APPEARANCE_DRAFT_STORAGE_KEY}.`)) {
      window.localStorage.removeItem(key);
    }
  }
}
