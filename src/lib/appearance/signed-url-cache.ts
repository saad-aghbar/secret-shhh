"use client";

import { apiGetWallpaperUrl } from "@/lib/appearance/client-api";

type CacheEntry = {
  url: string;
  expiresAt: number;
};

const REFRESH_EARLY_MS = 60_000;
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string>>();

export async function getSignedWallpaperUrl(assetId: string): Promise<string> {
  const existing = cache.get(assetId);
  if (existing && existing.expiresAt - Date.now() > REFRESH_EARLY_MS) {
    return existing.url;
  }

  const pending = inflight.get(assetId);
  if (pending) return pending;

  const request = apiGetWallpaperUrl(assetId)
    .then((result) => {
      cache.set(assetId, {
        url: result.url,
        expiresAt: new Date(result.expiresAt).getTime(),
      });
      return result.url;
    })
    .finally(() => {
      inflight.delete(assetId);
    });
  inflight.set(assetId, request);
  return request;
}

export function clearSignedWallpaperUrlCache() {
  cache.clear();
  inflight.clear();
}
