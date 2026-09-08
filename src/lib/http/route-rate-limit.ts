import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { loginThrottle } from "@/lib/db/schema";
import { RouteRateLimitError } from "@/lib/http/route-rate-limit-error";

const DEFAULT_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_MAX = 80;

export async function assertRouteRateLimit(params: {
  key: string;
  max?: number;
  windowMs?: number;
  message?: string;
}) {
  const db = getDb();
  const now = new Date();
  const max = params.max ?? DEFAULT_MAX;
  const windowMs = params.windowMs ?? DEFAULT_WINDOW_MS;
  const key = params.key;
  const row = (await db.select().from(loginThrottle).where(eq(loginThrottle.key, key)).limit(1))[0];

  if (!row) {
    await db.insert(loginThrottle).values({
      key,
      failCount: 1,
      windowStartedAt: now,
      lockedUntil: null,
    });
    return;
  }

  const expired = now.getTime() - row.windowStartedAt.getTime() > windowMs;
  if (expired) {
    await db
      .update(loginThrottle)
      .set({ failCount: 1, windowStartedAt: now, lockedUntil: null })
      .where(eq(loginThrottle.key, key));
    return;
  }

  if (row.failCount >= max) {
    throw new RouteRateLimitError(params.message ?? "Try again in a moment.");
  }

  await db
    .update(loginThrottle)
    .set({ failCount: row.failCount + 1 })
    .where(eq(loginThrottle.key, key));
}
