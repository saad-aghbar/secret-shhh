"use client";

import type { WallpaperConfig } from "@/lib/appearance/config";
import type { AppearancePayload, WallpaperReadUrl, WallpaperUploadInit } from "@/lib/appearance/types";
import type { ApiErrorBody } from "@/types/api";

type Listener = (payload: AppearancePayload) => void;

let cached: AppearancePayload | null = null;
let inflight: Promise<AppearancePayload> | null = null;
const listeners = new Set<Listener>();

async function parse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T | Partial<ApiErrorBody>;
  if (!response.ok) {
    throw new Error((body as Partial<ApiErrorBody>).message || "Couldn't save this look.");
  }
  return body as T;
}

function emit(payload: AppearancePayload) {
  cached = payload;
  for (const listener of listeners) listener(payload);
}

export function getCachedAppearance() {
  return cached;
}

export function subscribeAppearance(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function rememberAppearance(payload: AppearancePayload) {
  emit(payload);
}

export async function apiGetAppearance(force = false): Promise<AppearancePayload> {
  if (!force && cached) return cached;
  if (inflight) return inflight;
  inflight = parse<AppearancePayload>(await fetch("/api/appearance", { cache: "no-store" }))
    .then((payload) => {
      emit(payload);
      return payload;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export async function apiSavePersonalAppearance(config: WallpaperConfig): Promise<AppearancePayload> {
  const payload = await parse<AppearancePayload>(
    await fetch("/api/appearance/personal", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(config),
    }),
  );
  emit(payload);
  return payload;
}

export async function apiClearPersonalAppearance(): Promise<AppearancePayload> {
  const payload = await parse<AppearancePayload>(
    await fetch("/api/appearance/personal", { method: "DELETE" }),
  );
  emit(payload);
  return payload;
}

export async function apiSaveSharedAppearance(config: WallpaperConfig): Promise<AppearancePayload> {
  const payload = await parse<AppearancePayload>(
    await fetch("/api/appearance/shared", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(config),
    }),
  );
  emit(payload);
  return payload;
}

export async function apiClearSharedAppearance(): Promise<AppearancePayload> {
  const payload = await parse<AppearancePayload>(
    await fetch("/api/appearance/shared", { method: "DELETE" }),
  );
  emit(payload);
  return payload;
}

export async function apiInitWallpaperUpload(input: {
  mimeType: string;
  size: number;
  width: number;
  height: number;
}): Promise<WallpaperUploadInit> {
  return parse<WallpaperUploadInit>(
    await fetch("/api/appearance/wallpaper/uploads/init", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function apiPutWallpaperContent(url: string, blob: Blob, headers: Record<string, string>) {
  const response = await fetch(url, { method: "PUT", headers, body: blob });
  if (!response.ok) {
    throw new Error("Couldn't save this photo. Try again.");
  }
}

export async function apiCompleteWallpaperUpload(assetId: string) {
  return parse<{ assetId: string; status: string }>(
    await fetch(`/api/appearance/wallpaper/uploads/${encodeURIComponent(assetId)}/complete`, {
      method: "POST",
    }),
  );
}

export async function apiGetWallpaperUrl(assetId: string): Promise<WallpaperReadUrl> {
  return parse<WallpaperReadUrl>(
    await fetch(`/api/appearance/wallpaper/${encodeURIComponent(assetId)}/url`, { cache: "no-store" }),
  );
}

export async function uploadWallpaperImage(input: {
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
}): Promise<string> {
  const init = await apiInitWallpaperUpload({
    mimeType: input.mimeType,
    size: input.blob.size,
    width: input.width,
    height: input.height,
  });
  await apiPutWallpaperContent(init.upload.url, input.blob, init.upload.headers);
  await apiCompleteWallpaperUpload(init.assetId);
  return init.assetId;
}

export function clearAppearanceClientCache() {
  cached = null;
  inflight = null;
}
