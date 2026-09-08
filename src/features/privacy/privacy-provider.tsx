"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { LockScreen } from "@/features/privacy/lock-screen";
import { PrivacyCover } from "@/features/privacy/privacy-cover";
import { enforceDiscreetMode } from "@/lib/privacy/discreet";
import {
  clearLocalHiddenAt,
  readLocalHiddenAt,
  readLocalLockFlag,
  writeLocalHiddenAt,
  writeLocalLockFlag,
} from "@/lib/privacy/local-lock";
import { LOCK_GRACE_MS, shouldEngageLock } from "@/lib/privacy/policy";
import {
  DEFAULT_PRIVACY_SETTINGS,
  normalizePrivacySettings,
  type PrivacySettings,
} from "@/lib/privacy/settings";

type UnlockResult = { ok: true } | { ok: false; error: string };

type PrivacyContextValue = {
  settings: PrivacySettings;
  locked: boolean;
  coverVisible: boolean;
  serverLocked: boolean;
  lockNow: () => Promise<void>;
  unlock: (password: string) => Promise<UnlockResult>;
  updateSettings: (patch: Partial<PrivacySettings>) => Promise<void>;
};

const PrivacyContext = createContext<PrivacyContextValue | null>(null);

export function usePrivacy() {
  const value = useContext(PrivacyContext);
  if (!value) {
    throw new Error("usePrivacy must be used within PrivacyProvider");
  }
  return value;
}

export function PrivacyProvider({
  children,
  initialLocked,
  initialSettings,
}: {
  children: ReactNode;
  initialLocked: boolean;
  initialSettings?: PrivacySettings | null;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState(() =>
    normalizePrivacySettings(initialSettings ?? DEFAULT_PRIVACY_SETTINGS),
  );
  const [locked, setLocked] = useState(initialLocked);
  /** Cold-load only. A later RSC with a lock cookie must not unmount a live call. */
  const [omitChildren, setOmitChildren] = useState(initialLocked);
  const [coverVisible, setCoverVisible] = useState(false);
  const settingsRef = useRef(settings);
  const lockedRef = useRef(locked);
  const hiddenAtRef = useRef<number | null>(null);
  const graceTimerRef = useRef<number | null>(null);
  const serverLockedRef = useRef(initialLocked);

  useEffect(() => {
    settingsRef.current = settings;
    lockedRef.current = locked;
    serverLockedRef.current = initialLocked;
  }, [initialLocked, locked, settings]);

  const lockNow = useCallback(async () => {
    writeLocalLockFlag(true);
    setLocked(true);
    lockedRef.current = true;
    await fetch("/api/privacy/lock", {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => undefined);
  }, []);

  const unlock = useCallback(async (password: string): Promise<UnlockResult> => {
    const response = await fetch("/api/privacy/unlock", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const body = (await response.json().catch(() => null)) as
      | { ok?: boolean; error?: string }
      | null;
    if (!response.ok || !body?.ok) {
      return { ok: false, error: body?.error || "That password isn’t right." };
    }
    writeLocalLockFlag(false);
    setLocked(false);
    lockedRef.current = false;
    setCoverVisible(false);
    setOmitChildren(false);
    if (serverLockedRef.current) {
      router.refresh();
    }
    return { ok: true };
  }, [router]);

  const updateSettings = useCallback(async (patch: Partial<PrivacySettings>) => {
    const previous = settingsRef.current;
    const next = normalizePrivacySettings({ ...previous, ...patch });
    if (patch.discreetMode === true) {
      next.lockOnLeave = true;
      next.blurWhenHidden = true;
      next.showAppBadge = false;
    }
    setSettings(next);
    settingsRef.current = next;
    try {
      const response = await fetch("/api/preferences", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!response.ok) throw new Error("Couldn't save");
      const saved = (await response.json()) as PrivacySettings;
      const normalized = normalizePrivacySettings(saved);
      setSettings(normalized);
      settingsRef.current = normalized;
    } catch {
      setSettings(previous);
      settingsRef.current = previous;
    }
  }, []);

  useEffect(() => {
    enforceDiscreetMode();
    if (initialLocked || readLocalLockFlag()) {
      /* eslint-disable react-hooks/set-state-in-effect -- hydrate lock from cookie/localStorage */
      setLocked(true);
      /* eslint-enable react-hooks/set-state-in-effect */
      lockedRef.current = true;
      writeLocalLockFlag(true);
      return;
    }
    // A visible remount after in-app navigation is not "away". Leftover
    // hiddenAt from pagehide would otherwise lock after 15s of normal use.
    if (document.visibilityState === "visible") {
      clearLocalHiddenAt();
      void fetch("/api/privacy/return", {
        method: "POST",
        credentials: "same-origin",
        keepalive: true,
      }).catch(() => undefined);
      return;
    }
    const hiddenAt = readLocalHiddenAt();
    if (
      shouldEngageLock({
        hiddenAtMs: hiddenAt,
        nowMs: Date.now(),
        lockOnLeave: settingsRef.current.lockOnLeave,
      })
    ) {
      void lockNow();
    }
  }, [initialLocked, lockNow]);

  useEffect(() => {
    function clearGrace() {
      if (graceTimerRef.current != null) {
        window.clearTimeout(graceTimerRef.current);
        graceTimerRef.current = null;
      }
    }

    function hide() {
      const now = Date.now();
      hiddenAtRef.current = now;
      writeLocalHiddenAt(now);
      const current = settingsRef.current;
      if (current.blurWhenHidden || current.discreetMode || current.lockOnLeave) {
        setCoverVisible(true);
      }
      void fetch("/api/privacy/leave", {
        method: "POST",
        credentials: "same-origin",
        keepalive: true,
      }).catch(() => undefined);
      if (current.lockOnLeave) {
        clearGrace();
        graceTimerRef.current = window.setTimeout(() => {
          void lockNow();
        }, LOCK_GRACE_MS);
      }
    }

    function show() {
      clearGrace();
      const hiddenAt = hiddenAtRef.current ?? readLocalHiddenAt();
      hiddenAtRef.current = null;
      setCoverVisible(false);
      if (
        shouldEngageLock({
          hiddenAtMs: hiddenAt,
          nowMs: Date.now(),
          lockOnLeave: settingsRef.current.lockOnLeave,
        })
      ) {
        void lockNow();
        return;
      }
      if (!lockedRef.current) {
        void fetch("/api/privacy/return", {
          method: "POST",
          credentials: "same-origin",
          keepalive: true,
        }).catch(() => undefined);
      }
    }

    function onVisibility() {
      if (document.visibilityState === "hidden") {
        hide();
        return;
      }
      show();
    }

    function onPageHide(event: PageTransitionEvent) {
      const now = Date.now();
      hiddenAtRef.current = now;
      writeLocalHiddenAt(now);
      const current = settingsRef.current;
      if (current.blurWhenHidden || current.discreetMode || current.lockOnLeave) {
        setCoverVisible(true);
      }
      void fetch("/api/privacy/leave", {
        method: "POST",
        credentials: "same-origin",
        keepalive: true,
      }).catch(() => undefined);
      // Unloading navigations must not keep the grace timer — a slow compile
      // would otherwise lock the next page from the dying document.
      if (!event.persisted) {
        clearGrace();
      }
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      clearGrace();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [lockNow]);

  const value = useMemo<PrivacyContextValue>(
    () => ({
      settings,
      locked,
      coverVisible,
      serverLocked: initialLocked,
      lockNow,
      unlock,
      updateSettings,
    }),
    [coverVisible, initialLocked, lockNow, locked, settings, unlock, updateSettings],
  );

  return (
    <PrivacyContext.Provider value={value}>
      <div
        inert={locked || undefined}
        aria-hidden={locked || undefined}
        className="min-h-full"
      >
        {omitChildren ? null : children}
      </div>
      {locked ? <LockScreen /> : null}
      {coverVisible ? <PrivacyCover /> : null}
    </PrivacyContext.Provider>
  );
}
