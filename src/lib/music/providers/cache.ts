import { and, eq, gt } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { musicProviderCache } from "@/lib/db/schema";

const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;

export async function readProviderCache<T>(key: string): Promise<T | null> {
  const db = getDb();
  const row = (
    await db
      .select()
      .from(musicProviderCache)
      .where(and(eq(musicProviderCache.cacheKey, key), gt(musicProviderCache.expiresAt, new Date())))
      .limit(1)
  )[0];
  if (!row) return null;
  return row.payload as T;
}

export async function writeProviderCache(input: {
  key: string;
  provider: string;
  payload: Record<string, unknown>;
  ttlMs?: number;
}) {
  const db = getDb();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (input.ttlMs ?? DEFAULT_TTL_MS));
  await db
    .insert(musicProviderCache)
    .values({
      cacheKey: input.key,
      provider: input.provider,
      payload: input.payload,
      createdAt: now,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: musicProviderCache.cacheKey,
      set: {
        payload: input.payload,
        provider: input.provider,
        createdAt: now,
        expiresAt,
      },
    });
}
