import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { loginThrottle } from "@/lib/db/schema";
import { hashOpaque } from "@/lib/auth/session-store";
import type { ProfileSlot } from "@/lib/auth/profiles";

const WINDOW_MS = 15 * 60 * 1000;
const FAIL_THRESHOLD = 5;
const MAX_LOCK_MS = 5 * 60 * 1000;

export function throttleKey(slot: ProfileSlot, ip: string | null): string {
  const ipPart = ip ? hashOpaque(ip).slice(0, 16) : "unknown";
  return `slot:${slot}|ip:${ipPart}`;
}

export type ThrottleStatus =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export async function getThrottleStatus(key: string): Promise<ThrottleStatus> {
  const db = getDb();
  const row = (await db.select().from(loginThrottle).where(eq(loginThrottle.key, key)).limit(1))[0];
  if (!row?.lockedUntil) {
    return { allowed: true };
  }
  const now = Date.now();
  if (row.lockedUntil.getTime() <= now) {
    return { allowed: true };
  }
  return {
    allowed: false,
    retryAfterSeconds: Math.ceil((row.lockedUntil.getTime() - now) / 1000),
  };
}

export async function recordFailedAttempt(key: string): Promise<ThrottleStatus> {
  const db = getDb();
  const now = new Date();
  const existing = (
    await db.select().from(loginThrottle).where(eq(loginThrottle.key, key)).limit(1)
  )[0];

  if (!existing) {
    await db.insert(loginThrottle).values({
      key,
      failCount: 1,
      windowStartedAt: now,
      lockedUntil: null,
    });
    return { allowed: true };
  }

  const windowExpired = now.getTime() - existing.windowStartedAt.getTime() > WINDOW_MS;
  let failCount = windowExpired ? 1 : existing.failCount + 1;
  let windowStartedAt = windowExpired ? now : existing.windowStartedAt;
  let lockedUntil: Date | null = null;

  if (failCount >= FAIL_THRESHOLD) {
    // Escalating lock: 30s * 2^(overflow), capped at 5 minutes.
    const overflow = failCount - FAIL_THRESHOLD;
    const lockMs = Math.min(30_000 * 2 ** overflow, MAX_LOCK_MS);
    lockedUntil = new Date(now.getTime() + lockMs);
    // Soft-reset count so locks stay temporary rather than permanent.
    if (overflow >= 4) {
      failCount = FAIL_THRESHOLD;
      windowStartedAt = now;
    }
  }

  await db
    .update(loginThrottle)
    .set({ failCount, windowStartedAt, lockedUntil })
    .where(eq(loginThrottle.key, key));

  if (lockedUntil && lockedUntil.getTime() > now.getTime()) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000),
    };
  }

  return { allowed: true };
}

export async function clearThrottle(key: string) {
  const db = getDb();
  await db.delete(loginThrottle).where(eq(loginThrottle.key, key));
}
