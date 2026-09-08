import { eq } from "drizzle-orm";

import { MusicError } from "@/lib/music/errors";
import { getDb } from "@/lib/db";
import { loginThrottle } from "@/lib/db/schema";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_CALLS = 80;

function keyFor(userId: string, kind: string) {
  return `music-${kind}:${userId}`;
}

export async function assertMusicProviderAllowed(userId: string, kind: "resolve" | "search" | "match") {
  const db = getDb();
  const now = new Date();
  const key = keyFor(userId, kind);
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
  const expired = now.getTime() - row.windowStartedAt.getTime() > WINDOW_MS;
  if (expired) {
    await db
      .update(loginThrottle)
      .set({ failCount: 1, windowStartedAt: now, lockedUntil: null })
      .where(eq(loginThrottle.key, key));
    return;
  }
  if (row.failCount >= MAX_CALLS) {
    throw new MusicError("RATE_LIMITED", "Wait a moment, then try again.", 429);
  }
  await db
    .update(loginThrottle)
    .set({ failCount: row.failCount + 1 })
    .where(eq(loginThrottle.key, key));
}
