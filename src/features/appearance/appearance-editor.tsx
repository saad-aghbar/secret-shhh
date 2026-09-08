"use client";

import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AppearanceColorPicker } from "@/features/appearance/appearance-color-picker";
import { setAppearanceDirty } from "@/features/appearance/appearance-dirty";
import { AppearanceGradientEditor } from "@/features/appearance/appearance-gradient-editor";
import { AppearancePhotoEditor } from "@/features/appearance/appearance-photo-editor";
import { AppearancePresets } from "@/features/appearance/appearance-presets";
import { AppearancePreview, type PreviewSeed } from "@/features/appearance/appearance-preview";
import {
  hasStoredWallpaperConfig,
  useAppearanceDraft,
} from "@/features/appearance/use-appearance-draft";
import { ThemeEntryCards } from "@/features/theme/theme-entry-cards";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ShhhButton, ShhhModal, ShhhSlider, ShhhToggle } from "@/components/shhh";
import type { AppearanceTheme } from "@/lib/appearance/config";
import {
  apiClearPersonalAppearance,
  apiClearSharedAppearance,
  apiSavePersonalAppearance,
  apiSaveSharedAppearance,
  rememberAppearance,
  uploadWallpaperImage,
} from "@/lib/appearance/client-api";
import { getSignedWallpaperUrl } from "@/lib/appearance/signed-url-cache";
import { CONSUMER_APPEARANCE_ERRORS } from "@/lib/appearance/limits";
import {
  configFromColor,
  configFromDefault,
  configFromGradient,
  GRADIENT_PRESETS,
} from "@/lib/appearance/presets";
import { prepareWallpaperImage } from "@/lib/appearance/prepare-image";
import { overlayFloorFor, resolveChatAppearance } from "@/lib/appearance/resolve";
import type { AppearancePayload } from "@/lib/appearance/types";
import { getCachedTheme, rememberTheme, subscribeTheme } from "@/lib/theme/client-api";
import type { ThemePayload } from "@/lib/theme/types";
import { connectionManager } from "@/lib/connection/manager";
import { getRealtimeTestBus } from "@/lib/realtime/test-bus";

export function AppearanceEditor({
  initial,
  conversationId,
  userId,
  seed,
  themePayload,
}: {
  initial: AppearancePayload;
  conversationId: string;
  userId: string;
  seed: PreviewSeed;
  themePayload: ThemePayload;
}) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const theme: AppearanceTheme = resolvedTheme === "dark" ? "dark" : "light";
  const draftState = useAppearanceDraft(initial, userId);
  const { mode, setMode, draft, setDraft, dirty, resetDraftToSaved, rememberSaved, saved } =
    draftState;
  const [busy, setBusy] = useState(false);
  const [localPhotoUrl, setLocalPhotoUrl] = useState<string | null>(null);
  const [fetchedPhotoUrl, setFetchedPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [sharedConfirm, setSharedConfirm] = useState(false);
  const [sharedResetConfirm, setSharedResetConfirm] = useState(false);
  useEffect(() => {
    setAppearanceDirty(dirty);
    return () => setAppearanceDirty(false);
  }, [dirty]);

  useEffect(() => {
    rememberAppearance(initial);
  }, [initial]);

  const [liveTheme, setLiveTheme] = useState(() => getCachedTheme() ?? themePayload);
  useEffect(() => {
    if (!getCachedTheme()) rememberTheme(themePayload);
    return subscribeTheme(setLiveTheme);
  }, [themePayload]);

  useEffect(() => {
    if (draft.type !== "image" || !draft.assetId) return;
    if (saved.imageUrl && saved.resolved.layer.assetId === draft.assetId) return;
    if (localPhotoUrl) return;
    let active = true;
    void getSignedWallpaperUrl(draft.assetId)
      .then((url) => {
        if (active) setFetchedPhotoUrl(url);
      })
      .catch(() => {
        if (active) setFetchedPhotoUrl(null);
      });
    return () => {
      active = false;
    };
  }, [draft.assetId, draft.type, localPhotoUrl, saved.imageUrl, saved.resolved.layer.assetId]);

  const photoUrl =
    draft.type === "image"
      ? (localPhotoUrl ??
        (saved.imageUrl && saved.resolved.layer.assetId === draft.assetId
          ? saved.imageUrl
          : fetchedPhotoUrl))
      : null;

  const resolved = useMemo(() => {
    const personalOverride = hasStoredWallpaperConfig(saved.personal);
    const previewPersonal = mode === "personal" && (dirty || personalOverride) ? draft : {};
    return resolveChatAppearance({
      personal: previewPersonal,
      shared: {
        mode: mode === "shared" ? draft.type : saved.sharedMode,
        config: mode === "shared" ? draft : saved.shared,
        mediaId:
          mode === "shared"
            ? draft.assetId
            : "assetId" in saved.shared
              ? saved.shared.assetId
              : undefined,
      },
      theme,
    });
  }, [dirty, draft, mode, saved.personal, saved.shared, saved.sharedMode, theme]);

  const persist = useCallback(
    async (target: "personal" | "shared" | "clear-personal" | "clear-shared") => {
      setBusy(true);
      try {
        const payload =
          target === "personal"
            ? await apiSavePersonalAppearance(draft)
            : target === "shared"
              ? await apiSaveSharedAppearance(draft)
              : target === "clear-personal"
                ? await apiClearPersonalAppearance()
                : await apiClearSharedAppearance();
        rememberSaved(payload);
        if (target === "shared" || target === "clear-shared") {
          getRealtimeTestBus().publish(conversationId, "appearance:changed", {
            version: payload.sharedVersion,
          });
        }
        router.refresh();
      } finally {
        setBusy(false);
        setSharedConfirm(false);
        setSharedResetConfirm(false);
      }
    },
    [conversationId, draft, rememberSaved, router],
  );

  async function onApply() {
    if (mode === "shared") {
      setSharedConfirm(true);
      return;
    }
    await persist("personal");
  }

  async function onPickPhoto(file: File) {
    setPhotoError(null);
    if (connectionManager.getState() === "offline") {
      setWaiting(true);
      return;
    }
    setWaiting(false);
    setUploading(true);
    try {
      const prepared = await prepareWallpaperImage(file);
      const assetId = await uploadWallpaperImage({
        blob: prepared.blob,
        mimeType: prepared.mimeType,
        width: prepared.width,
        height: prepared.height,
      });
      const url = URL.createObjectURL(prepared.blob);
      setLocalPhotoUrl(url);
      setDraft((prev) => ({
        ...prev,
        type: "image",
        assetId,
        color: undefined,
        gradient: undefined,
        focalX: 0.5,
        focalY: 0.5,
        zoom: 1,
      }));
    } catch (error) {
      setPhotoError(
        error instanceof Error ? error.message : CONSUMER_APPEARANCE_ERRORS.PREPARE_FAILED,
      );
    } finally {
      setUploading(false);
    }
  }

  const hint = mode === "personal" ? "Only you see this" : "You both see this";
  const overlayFloor = overlayFloorFor(draft.type, theme);

  return (
    <div
      data-testid="appearance-page"
      className="flex flex-1 flex-col gap-6 pb-8 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] lg:items-start"
    >
      <div className="lg:sticky lg:top-4">
        <AppearancePreview
          resolved={resolved}
          imageUrl={draft.type === "image" ? photoUrl : null}
          theme={theme}
          seed={seed}
          partnerName={saved.partnerName}
        />
      </div>

      <div className="flex flex-col gap-6">
        <div data-testid="appearance-mode">
          <ShhhToggle
            label="Who sees this background"
            value={mode}
            options={[
              { value: "personal", label: "Personal" },
              { value: "shared", label: "Shared" },
            ]}
            onChange={(value) => setMode(value as "personal" | "shared")}
          />
        </div>
        <p className="text-secondary-text text-sm" data-testid="appearance-mode-hint">
          {hint}
        </p>

        <AppearancePresets
          config={draft}
          onSelectDefault={() => setDraft((prev) => configFromDefault(prev))}
          onSelectColor={(color) => setDraft((prev) => configFromColor(color, prev))}
          onSelectGradient={(id) => {
            const preset = GRADIENT_PRESETS.find((item) => item.id === id);
            if (preset) setDraft((prev) => configFromGradient(preset, prev));
          }}
          onSelectPhoto={() => {
            if (draft.type !== "image") {
              setDraft((prev) => ({
                ...prev,
                type: "image",
                assetId: prev.assetId,
                color: undefined,
                gradient: undefined,
              }));
            }
            const input = document.querySelector<HTMLInputElement>(
              '[data-testid="appearance-photo-input"]',
            );
            input?.click();
          }}
        />

        {draft.type === "solid" ? (
          <AppearanceColorPicker
            color={draft.color ?? "#4a756c"}
            onSelect={(color) => setDraft((prev) => configFromColor(color, prev))}
          />
        ) : null}

        {draft.type === "gradient" ? (
          <AppearanceGradientEditor
            gradient={draft.gradient ?? { from: "#4a756c", to: "#e4efe9", direction: "vertical" }}
            onChange={(gradient) =>
              setDraft((prev) => ({
                ...prev,
                type: "gradient",
                gradient,
                color: undefined,
                assetId: undefined,
              }))
            }
          />
        ) : null}

        {draft.type === "image" ? (
          <AppearancePhotoEditor
            config={draft}
            imageUrl={photoUrl}
            uploading={uploading}
            waiting={waiting}
            error={photoError}
            onPick={onPickPhoto}
            onChangeFocal={(next) => setDraft((prev) => ({ ...prev, ...next }))}
            onResetFocal={() =>
              setDraft((prev) => ({ ...prev, focalX: 0.5, focalY: 0.5, zoom: 1 }))
            }
          />
        ) : null}

        {draft.type !== "none" ? (
          <div className="flex flex-col gap-4" data-testid="appearance-adjust">
            <SliderRow
              label="Blur"
              testId="appearance-slider-blur"
              value={draft.blur}
              onChange={(blur) => setDraft((prev) => ({ ...prev, blur }))}
            />
            <SliderRow
              label="Dim"
              testId="appearance-slider-dim"
              value={draft.dim}
              onChange={(dim) => setDraft((prev) => ({ ...prev, dim }))}
            />
            <SliderRow
              label="Readability"
              testId="appearance-slider-overlay"
              min={overlayFloor}
              value={Math.max(draft.overlay, overlayFloor)}
              onChange={(overlay) => setDraft((prev) => ({ ...prev, overlay }))}
            />
          </div>
        ) : null}

        <div className="flex gap-2">
          <ShhhButton
            type="button"
            variant="primary"
            fullWidth
            disabled={!dirty || busy || (draft.type === "image" && !draft.assetId)}
            data-testid="appearance-apply"
            onClick={() => void onApply()}
          >
            {busy ? "Saving…" : "Apply"}
          </ShhhButton>
          <ShhhButton
            type="button"
            variant="secondary"
            fullWidth
            disabled={!dirty || busy}
            data-testid="appearance-cancel"
            onClick={resetDraftToSaved}
          >
            Cancel
          </ShhhButton>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-primary-text text-sm font-semibold">Theme</p>
          <ThemeToggle />
          <ThemeEntryCards payload={liveTheme} />
        </div>
        <button
          type="button"
          className="text-secondary-text text-sm"
          data-testid="appearance-reset"
          disabled={busy}
          onClick={() => {
            if (mode === "personal") {
              void persist("clear-personal");
              return;
            }
            setSharedResetConfirm(true);
          }}
        >
          {mode === "personal" ? "Use our shared background" : "Reset to the default background"}
        </button>
      </div>

      <ShhhModal
        open={sharedConfirm}
        onClose={() => setSharedConfirm(false)}
        title="Change both of your backgrounds?"
        footer={
          <div className="flex flex-col gap-2">
            <ShhhButton
              type="button"
              data-testid="appearance-shared-confirm"
              onClick={() => void persist("shared")}
            >
              Change it
            </ShhhButton>
            <ShhhButton type="button" variant="ghost" onClick={() => setSharedConfirm(false)}>
              Not now
            </ShhhButton>
          </div>
        }
      >
        <p className="text-secondary-text text-sm leading-relaxed">
          {saved.partnerName} will see this background too.
        </p>
      </ShhhModal>

      <ShhhModal
        open={sharedResetConfirm}
        onClose={() => setSharedResetConfirm(false)}
        title="Reset the shared background?"
        footer={
          <div className="flex flex-col gap-2">
            <ShhhButton
              type="button"
              data-testid="appearance-shared-reset-confirm"
              onClick={() => void persist("clear-shared")}
            >
              Reset
            </ShhhButton>
            <ShhhButton type="button" variant="ghost" onClick={() => setSharedResetConfirm(false)}>
              Keep it
            </ShhhButton>
          </div>
        }
      >
        <p className="text-secondary-text text-sm leading-relaxed">
          Chat will go back to the default Shhh background for both of you.
        </p>
      </ShhhModal>
    </div>
  );
}

function SliderRow({
  label,
  testId,
  value,
  min = 0,
  onChange,
}: {
  label: string;
  testId: string;
  value: number;
  min?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-primary-text text-sm font-semibold">{label}</span>
      <ShhhSlider
        label={label}
        min={min}
        max={1}
        step={0.01}
        value={value}
        data-testid={testId}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
