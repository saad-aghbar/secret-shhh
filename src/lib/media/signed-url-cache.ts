"use client";

import { apiGetMediaUrl, type MediaUrlVariant } from "@/lib/media/client-api";

type CacheEntry = {
  url: string;
  expiresAt: number;
};

const REFRESH_EARLY_MS = 60_000;
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string>>();

function key(mediaId: string, variant: MediaUrlVariant, download: boolean) {
  return `${mediaId}:${variant}:${download ? "download" : "view"}`;
}

export async function getSignedMediaUrl(
  mediaId: string,
  variant: MediaUrlVariant,
  download = false,
): Promise<string> {
  const cacheKey = key(mediaId, variant, download);
  const existing = cache.get(cacheKey);
  if (existing && existing.expiresAt - Date.now() > REFRESH_EARLY_MS) {
    return existing.url;
  }

  const pending = inflight.get(cacheKey);
  if (pending) return pending;

  const request = apiGetMediaUrl(mediaId, variant, download)
    .then((result) => {
      cache.set(cacheKey, {
        url: result.url,
        expiresAt: new Date(result.expiresAt).getTime(),
      });
      return result.url;
    })
    .finally(() => {
      inflight.delete(cacheKey);
    });
  inflight.set(cacheKey, request);
  return request;
}

export function clearSignedMediaUrlCache() {
  cache.clear();
  inflight.clear();
}
