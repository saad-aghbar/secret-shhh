"use client";

import { apiGetStickerUrl } from "@/lib/stickers/client-api";

type CacheEntry = {
  url: string;
  expiresAt: number;
};

const REFRESH_EARLY_MS = 60_000;
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string>>();

export async function getSignedStickerUrl(stickerId: string): Promise<string> {
  const existing = cache.get(stickerId);
  if (existing && existing.expiresAt - Date.now() > REFRESH_EARLY_MS) {
    return existing.url;
  }

  const pending = inflight.get(stickerId);
  if (pending) return pending;

  const request = apiGetStickerUrl(stickerId)
    .then((result) => {
      cache.set(stickerId, {
        url: result.url,
        expiresAt: new Date(result.expiresAt).getTime(),
      });
      return result.url;
    })
    .finally(() => {
      inflight.delete(stickerId);
    });
  inflight.set(stickerId, request);
  return request;
}

export function clearSignedStickerUrlCache() {
  cache.clear();
  inflight.clear();
}
