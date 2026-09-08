"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { defaultWallpaperConfig, type WallpaperConfig } from "@/lib/appearance/config";
import {
  clearAppearanceDraft,
  readAppearanceDraft,
  writeAppearanceDraft,
  type AppearanceMode,
} from "@/lib/appearance/draft-storage";
import type { AppearancePayload } from "@/lib/appearance/types";

function configsEqual(a: WallpaperConfig, b: WallpaperConfig) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function hasStoredWallpaperConfig(
  value: AppearancePayload["personal"] | AppearancePayload["shared"],
): value is WallpaperConfig {
  return Boolean(value && typeof value === "object" && "type" in value && typeof (value as WallpaperConfig).type === "string");
}

/**
 * What the editor should treat as the clean baseline.
 * Empty personal is *not* the same as type:"none" — it inherits the resolved
 * chat look (shared, then default) so Default can still be applied as an override.
 */
export function editorBaseline(mode: AppearanceMode, payload: AppearancePayload): WallpaperConfig {
  if (mode === "personal") {
    if (hasStoredWallpaperConfig(payload.personal)) return payload.personal;
    return payload.resolved.config;
  }
  if (hasStoredWallpaperConfig(payload.shared)) return payload.shared;
  return defaultWallpaperConfig();
}

export function useAppearanceDraft(initial: AppearancePayload, userId?: string) {
  const stored = useMemo(() => readAppearanceDraft(userId), [userId]);
  const [mode, setModeState] = useState<AppearanceMode>(stored?.mode ?? "personal");
  const [personalDraft, setPersonalDraft] = useState<WallpaperConfig>(
    stored?.personal ?? editorBaseline("personal", initial),
  );
  const [sharedDraft, setSharedDraft] = useState<WallpaperConfig>(
    stored?.shared ?? editorBaseline("shared", initial),
  );
  const [saved, setSaved] = useState(initial);

  const draft = mode === "personal" ? personalDraft : sharedDraft;
  const currentSaved = editorBaseline(mode, saved);
  const dirty = !configsEqual(draft, currentSaved);

  useEffect(() => {
    writeAppearanceDraft({
      userId,
      mode,
      personal: personalDraft,
      shared: sharedDraft,
      savedAt: Date.now(),
    });
  }, [mode, personalDraft, sharedDraft, userId]);

  const setMode = useCallback((next: AppearanceMode) => {
    setModeState(next);
  }, []);

  const setDraft = useCallback(
    (next: WallpaperConfig | ((prev: WallpaperConfig) => WallpaperConfig)) => {
      const apply = (prev: WallpaperConfig) => (typeof next === "function" ? next(prev) : next);
      if (mode === "personal") setPersonalDraft(apply);
      else setSharedDraft(apply);
    },
    [mode],
  );

  const resetDraftToSaved = useCallback(() => {
    if (mode === "personal") setPersonalDraft(editorBaseline("personal", saved));
    else setSharedDraft(editorBaseline("shared", saved));
  }, [mode, saved]);

  const rememberSaved = useCallback((payload: AppearancePayload) => {
    setSaved(payload);
    setPersonalDraft(editorBaseline("personal", payload));
    setSharedDraft(editorBaseline("shared", payload));
    clearAppearanceDraft();
  }, []);

  return {
    mode,
    setMode,
    draft,
    setDraft,
    saved,
    currentSaved,
    dirty,
    resetDraftToSaved,
    rememberSaved,
  };
}
