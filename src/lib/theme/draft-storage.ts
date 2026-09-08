import { defaultThemeConfig, type ThemeConfig, type ThemeMode } from "@/lib/theme/config";
import { parseThemeConfigLoose } from "@/lib/theme/validation";

export const THEME_DRAFT_STORAGE_KEY = "shhh.theme.draft";
export const THEME_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type ThemeDraftStore = {
  userId?: string;
  target: ThemeMode;
  draft: ThemeConfig;
  savedAt: number;
};

function keyFor(userId: string | undefined, target: ThemeMode) {
  return userId
    ? `${THEME_DRAFT_STORAGE_KEY}.${userId}.${target}`
    : `${THEME_DRAFT_STORAGE_KEY}.${target}`;
}

export function readThemeDraft(userId: string | undefined, target: ThemeMode): ThemeConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(keyFor(userId, target));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ThemeDraftStore;
    if (!parsed || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > THEME_DRAFT_MAX_AGE_MS) {
      window.localStorage.removeItem(keyFor(userId, target));
      return null;
    }
    if (userId && parsed.userId && parsed.userId !== userId) return null;
    return parseThemeConfigLoose(parsed.draft, target) ?? defaultThemeConfig();
  } catch {
    return null;
  }
}

export function writeThemeDraft(store: ThemeDraftStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    keyFor(store.userId, store.target),
    JSON.stringify({ ...store, savedAt: Date.now() }),
  );
}

export function clearThemeDraft(userId?: string, target?: ThemeMode) {
  if (typeof window === "undefined") return;
  if (userId && target) {
    window.localStorage.removeItem(keyFor(userId, target));
    return;
  }
  for (const key of Object.keys(window.localStorage)) {
    if (key === THEME_DRAFT_STORAGE_KEY || key.startsWith(`${THEME_DRAFT_STORAGE_KEY}.`)) {
      window.localStorage.removeItem(key);
    }
  }
}
