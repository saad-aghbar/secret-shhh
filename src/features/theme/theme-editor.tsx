"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ThemeAppPreview } from "@/features/theme/theme-app-preview";
import { ThemeColorRow } from "@/features/theme/theme-color-row";
import { ThemeColorSheet } from "@/features/theme/theme-color-sheet";
import { ThemePresetRow } from "@/features/theme/theme-preset-row";
import { setThemeDirty } from "@/features/theme/theme-dirty";
import { useThemeDraft } from "@/features/theme/use-theme-draft";
import { ShhhButton, ShhhModal } from "@/components/shhh";
import { applyThemeCss, playThemeTransition, publishThemeChange } from "@/lib/theme/apply-document";
import { apiResetThemeConfig, apiSaveThemeConfig, rememberTheme } from "@/lib/theme/client-api";
import { themeCssText } from "@/lib/theme/css";
import {
  THEME_COLOR_KEYS,
  THEME_FIELD_META,
  type HexColor,
  type ThemeColorKey,
  type ThemeMode,
} from "@/lib/theme/config";
import { resolveTheme, themeConfigFromPreset, withThemeColor } from "@/lib/theme/resolve";
import type { ThemePayload } from "@/lib/theme/types";

const MAIN_FIELDS = THEME_COLOR_KEYS.filter((key) => THEME_FIELD_META[key].group === "main");
const MORE_FIELDS = THEME_COLOR_KEYS.filter((key) => THEME_FIELD_META[key].group === "more");

export function ThemeEditor({
  initial,
  target,
  userId,
}: {
  initial: ThemePayload;
  target: ThemeMode;
  userId: string;
}) {
  const router = useRouter();
  const { draft, setDraft, dirty, resetDraftToSaved, rememberSaved } = useThemeDraft(
    initial,
    target,
    userId,
  );
  const [busy, setBusy] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [editing, setEditing] = useState<ThemeColorKey | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const resolved = useMemo(() => resolveTheme({ stored: draft, mode: target }), [draft, target]);

  useEffect(() => {
    rememberTheme(initial);
  }, [initial]);

  useEffect(() => {
    setThemeDirty(dirty);
    return () => setThemeDirty(false);
  }, [dirty]);

  async function persist() {
    setBusy(true);
    try {
      const payload = await apiSaveThemeConfig(target, draft);
      applyThemeCss(themeCssText(payload.resolvedLight, payload.resolvedDark));
      playThemeTransition();
      publishThemeChange(userId);
      rememberSaved(payload);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function persistReset() {
    setBusy(true);
    try {
      const payload = await apiResetThemeConfig(target);
      applyThemeCss(themeCssText(payload.resolvedLight, payload.resolvedDark));
      playThemeTransition();
      publishThemeChange(userId);
      rememberSaved(payload);
      setResetOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const title = target === "light" ? "Customize Light" : "Customize Dark";
  const resetLabel = target === "light" ? "Reset Light theme" : "Reset Dark theme";

  return (
    <div data-testid="theme-editor" className="flex flex-1 flex-col gap-6 pb-28 lg:pb-8">
      <div className="flex flex-1 flex-col gap-6 lg:grid lg:grid-cols-[minmax(18rem,0.9fr)_minmax(22rem,1.1fr)] lg:items-start">
      <div className="lg:sticky lg:top-4">
        <p className="text-secondary-text mb-3 text-sm">
          {title}. The rest of Shhh stays on your current mode until you apply.
        </p>
        <ThemeAppPreview resolved={resolved} />
      </div>

      <div className="flex flex-col gap-6">
        <ThemePresetRow
          target={target}
          config={draft}
          onSelect={(presetId) => setDraft(themeConfigFromPreset(presetId))}
        />

        <div>
          <p className="text-primary-text mb-1 text-sm font-semibold">Colors</p>
          <div className="flex flex-col">
            {MAIN_FIELDS.map((field) => (
              <ThemeColorRow
                key={field}
                field={field}
                authored={resolved.authored}
                tokens={resolved.tokens}
                onOpen={setEditing}
              />
            ))}
          </div>
        </div>

        <div>
          <button
            type="button"
            className="text-accent text-sm font-semibold"
            data-testid="theme-more-colors"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
          >
            {moreOpen ? "Fewer colors" : "More colors"}
          </button>
          {moreOpen ? (
            <div className="mt-2 flex flex-col" data-testid="theme-more-fields">
              {MORE_FIELDS.map((field) => (
                <ThemeColorRow
                  key={field}
                  field={field}
                  authored={resolved.authored}
                  tokens={resolved.tokens}
                  onOpen={setEditing}
                />
              ))}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className="text-secondary-text text-sm"
          data-testid="theme-reset"
          disabled={busy}
          onClick={() => setResetOpen(true)}
        >
          {resetLabel}
        </button>
      </div>
      </div>

      <div
        className="border-divider/50 bg-background/92 fixed inset-x-0 z-50 border-t px-4 pt-3 pb-3 backdrop-blur-md lg:static lg:z-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
        style={{ bottom: "calc(4.75rem + var(--shhh-safe-bottom))" }}
      >
        <div className="mx-auto flex max-w-lg gap-2 lg:max-w-none">
          <ShhhButton
            type="button"
            fullWidth
            disabled={!dirty || busy}
            data-testid="theme-apply"
            onClick={() => void persist()}
          >
            {busy ? "Saving…" : "Apply"}
          </ShhhButton>
          <ShhhButton
            type="button"
            variant="secondary"
            fullWidth
            disabled={!dirty || busy}
            data-testid="theme-cancel"
            onClick={resetDraftToSaved}
          >
            Cancel
          </ShhhButton>
        </div>
      </div>

      <ThemeColorSheet
        field={editing}
        value={(editing ? resolved.authored[editing] : resolved.tokens.accent) as HexColor}
        onClose={() => setEditing(null)}
        onSelect={(color) => {
          if (!editing) return;
          setDraft((prev) => withThemeColor(prev, editing, color));
        }}
      />

      <ShhhModal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title={resetLabel}
        footer={
          <div className="flex flex-col gap-2">
            <ShhhButton
              type="button"
              data-testid="theme-reset-confirm"
              disabled={busy}
              onClick={() => void persistReset()}
            >
              Reset
            </ShhhButton>
            <ShhhButton type="button" variant="ghost" onClick={() => setResetOpen(false)}>
              Keep it
            </ShhhButton>
          </div>
        }
      >
        <p className="text-secondary-text text-sm leading-relaxed">
          This goes back to the original Shhh look. Your wallpaper stays as it is.
        </p>
      </ShhhModal>
    </div>
  );
}
