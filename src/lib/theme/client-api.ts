"use client";

import type { ThemeConfig, ThemeMode, ThemePreference } from "@/lib/theme/config";
import type { ThemePayload } from "@/lib/theme/types";
import type { ApiErrorBody } from "@/types/api";

type Listener = (payload: ThemePayload) => void;

let cached: ThemePayload | null = null;
let inflight: Promise<ThemePayload> | null = null;
const listeners = new Set<Listener>();

async function parse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T | Partial<ApiErrorBody>;
  if (!response.ok) {
    throw new Error((body as Partial<ApiErrorBody>).message || "Couldn't save this theme.");
  }
  return body as T;
}

function emit(payload: ThemePayload) {
  cached = payload;
  for (const listener of listeners) listener(payload);
}

export function getCachedTheme() {
  return cached;
}

export function subscribeTheme(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function rememberTheme(payload: ThemePayload) {
  emit(payload);
}

export async function apiGetTheme(force = false): Promise<ThemePayload> {
  if (!force && cached) return cached;
  if (inflight) return inflight;
  inflight = parse<ThemePayload>(await fetch("/api/theme", { cache: "no-store" }))
    .then((payload) => {
      emit(payload);
      return payload;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export async function apiSaveThemeConfig(
  target: ThemeMode,
  config: ThemeConfig,
): Promise<ThemePayload> {
  const payload = await parse<ThemePayload>(
    await fetch("/api/theme", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target, config }),
    }),
  );
  emit(payload);
  return payload;
}

export async function apiResetThemeConfig(target: ThemeMode): Promise<ThemePayload> {
  const payload = await parse<ThemePayload>(
    await fetch(`/api/theme?target=${encodeURIComponent(target)}`, { method: "DELETE" }),
  );
  emit(payload);
  return payload;
}

export async function apiSaveThemeMode(mode: ThemePreference): Promise<ThemePayload> {
  const payload = await parse<ThemePayload>(
    await fetch("/api/theme", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode }),
    }),
  );
  emit(payload);
  return payload;
}

export function clearThemeClientCache() {
  cached = null;
  inflight = null;
}
