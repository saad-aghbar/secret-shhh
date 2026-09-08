import { eq } from "drizzle-orm";
import { headers } from "next/headers";

import { isAcceptablePassword, verifyPassword } from "@/lib/auth/pin";
import { getProfileBySlot } from "@/lib/auth/profiles";
import {
  clearThrottle,
  getThrottleStatus,
  recordFailedAttempt,
  throttleKey,
} from "@/lib/auth/rate-limit";
import type { AuthorizedSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getServerEnv } from "@/lib/env";

function clientIp(headerList: Headers): string | null {
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  return headerList.get("x-real-ip");
}

export async function verifyUnlockPassword(params: {
  session: AuthorizedSession;
  password: string;
  ip?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isAcceptablePassword(params.password)) {
    return { ok: false, error: "That password isn’t right." };
  }

  const ip =
    params.ip !== undefined ? params.ip : clientIp(await headers());
  const key = throttleKey(params.session.slot, ip);
  const status = await getThrottleStatus(key);
  if (!status.allowed) {
    return { ok: false, error: "Try again in a moment." };
  }

  const db = getDb();
  const user = (
    await db.select().from(users).where(eq(users.id, params.session.user.id)).limit(1)
  )[0];
  let hashToCheck = user?.passwordHash ?? null;
  if (!hashToCheck) {
    const env = getServerEnv();
    hashToCheck = getProfileBySlot(params.session.slot, env).pinHash;
  }
  if (!hashToCheck) {
    return { ok: false, error: "Unable to unlock right now. Try again." };
  }

  const ok = await verifyPassword(params.password, hashToCheck);
  if (!ok) {
    const afterFail = await recordFailedAttempt(key);
    if (!afterFail.allowed) {
      return { ok: false, error: "Try again in a moment." };
    }
    return { ok: false, error: "That password isn’t right." };
  }

  await clearThrottle(key);
  return { ok: true };
}
