"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { registerThemeDiscard } from "@/features/theme/theme-dirty";
import { defaultThemeConfig, themeConfigsEqual, type ThemeConfig, type ThemeMode } from "@/lib/theme/config";
import { clearThemeDraft, readThemeDraft, writeThemeDraft } from "@/lib/theme/draft-storage";
import { editorThemeBaseline } from "@/lib/theme/resolve";
import type { ThemePayload } from "@/lib/theme/types";

export function useThemeDraft(initial: ThemePayload, target: ThemeMode, userId?: string) {
  const stored = useMemo(() => readThemeDraft(userId, target), [target, userId]);
  const baseline = editorThemeBaseline(initial, target);
  const [draft, setDraft] = useState<ThemeConfig>(stored ?? baseline);
  const [saved, setSaved] = useState(initial);
  const currentSaved = editorThemeBaseline(saved, target);
  const dirty = !themeConfigsEqual(draft, currentSaved);

  useEffect(() => {
    writeThemeDraft({
      userId,
      target,
      draft,
      savedAt: Date.now(),
    });
  }, [draft, target, userId]);

  useEffect(() => {
    return registerThemeDiscard(() => {
      setDraft(editorThemeBaseline(saved, target));
      clearThemeDraft(userId, target);
    });
  }, [saved, target, userId]);

  const resetDraftToSaved = useCallback(() => {
    setDraft(editorThemeBaseline(saved, target));
  }, [saved, target]);

  const rememberSaved = useCallback(
    (payload: ThemePayload) => {
      setSaved(payload);
      setDraft(editorThemeBaseline(payload, target));
      clearThemeDraft(userId, target);
    },
    [target, userId],
  );

  const resetToDefault = useCallback(() => {
    setDraft(defaultThemeConfig());
  }, []);

  return {
    draft,
    setDraft,
    saved,
    currentSaved,
    dirty,
    resetDraftToSaved,
    rememberSaved,
    resetToDefault,
  };
}
