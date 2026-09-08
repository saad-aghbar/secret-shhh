import { eq } from "drizzle-orm";

import { CALL_START_MAX, CALL_START_WINDOW_MS } from "@/lib/calls/config";
import { CallError } from "@/lib/calls/errors";
import { getDb } from "@/lib/db";
import { loginThrottle } from "@/lib/db/schema";

function keyFor(userId: string) {
  return `call-start:${userId}`;
}

export async function assertCallStartAllowed(userId: string) {
  const db = getDb();
  const now = new Date();
  const key = keyFor(userId);
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
  const windowExpired = now.getTime() - row.windowStartedAt.getTime() > CALL_START_WINDOW_MS;
  if (windowExpired) {
    await db
      .update(loginThrottle)
      .set({ failCount: 1, windowStartedAt: now, lockedUntil: null })
      .where(eq(loginThrottle.key, key));
    return;
  }
  if (row.failCount >= CALL_START_MAX) {
    throw new CallError("RATE_LIMITED", "Wait a moment before calling again.", 429);
  }
  await db
    .update(loginThrottle)
    .set({ failCount: row.failCount + 1 })
    .where(eq(loginThrottle.key, key));
}
