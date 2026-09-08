"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  bootstrapUserBySlot,
  updateUserPasswordHash,
} from "@/lib/auth/bootstrap";
import {
  clearSessionCookie,
  readSessionCookie,
  setSessionCookie,
} from "@/lib/auth/cookies";
import {
  hashPassword,
  isAcceptablePassword,
  verifyPassword,
} from "@/lib/auth/pin";
import { getProfileBySlot, profileSlotSchema } from "@/lib/auth/profiles";
import {
  clearThrottle,
  getThrottleStatus,
  recordFailedAttempt,
  throttleKey,
} from "@/lib/auth/rate-limit";
import { requireAuthorizedUser } from "@/lib/auth/session";
import { createSession, revokeSessionByToken } from "@/lib/auth/session-store";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getServerEnv } from "@/lib/env";
import { clearLockCookies } from "@/lib/privacy/lock-cookie";

const loginSchema = z.object({
  slot: profileSlotSchema,
  password: z.string().min(1).max(1024),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(1024),
  newPassword: z.string().min(1).max(1024),
  confirmPassword: z.string().min(1).max(1024),
});

export type AuthActionResult =
  | { ok: true; slot?: "user_1" | "user_2" }
  | { ok: false; error: string };

function clientIp(headerList: Headers): string | null {
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  return headerList.get("x-real-ip");
}

/**
 * Client submits only slot + password. Hashes stay server-side.
 * Prefers DB password hash; falls back to env seed hash on first login.
 */
export async function loginWithPassword(input: {
  slot: unknown;
  password: unknown;
}): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success || !isAcceptablePassword(parsed.data.password)) {
    return { ok: false, error: "That password isn’t right." };
  }

  let env;
  try {
    env = getServerEnv();
  } catch {
    return {
      ok: false,
      error: "Sign-in isn’t configured yet. Check server environment variables.",
    };
  }

  const headerList = await headers();
  const ip = clientIp(headerList);
  const key = throttleKey(parsed.data.slot, ip);

  try {
    const status = await getThrottleStatus(key);
    if (!status.allowed) {
      return { ok: false, error: "Try again in a moment." };
    }

    const profile = getProfileBySlot(parsed.data.slot, env);
    const db = getDb();
    const existing = (
      await db.select().from(users).where(eq(users.profileSlot, profile.slot)).limit(1)
    )[0];

    const hashToCheck = existing?.passwordHash || profile.pinHash;
    const ok = await verifyPassword(parsed.data.password, hashToCheck);

    if (!ok) {
      const afterFail = await recordFailedAttempt(key);
      if (!afterFail.allowed) {
        return { ok: false, error: "Try again in a moment." };
      }
      return { ok: false, error: "That password isn’t right." };
    }

    await clearThrottle(key);

    const bootstrapped = await bootstrapUserBySlot({
      slot: profile.slot,
      displayName: profile.displayName,
      passwordHash: existing?.passwordHash ?? profile.pinHash,
    });

    const { token } = await createSession({
      userId: bootstrapped.user.id,
      ip,
      userAgent: headerList.get("user-agent"),
    });

    await setSessionCookie(token, env.AUTH_SESSION_DAYS * 24 * 60 * 60);
    await clearLockCookies();
    return { ok: true, slot: profile.slot };
  } catch {
    return { ok: false, error: "Unable to sign in right now. Try again." };
  }
}

/** @deprecated use loginWithPassword */
export async function loginWithPin(input: {
  slot: unknown;
  pin: unknown;
}): Promise<AuthActionResult> {
  return loginWithPassword({ slot: input.slot, password: input.pin });
}

export async function changePassword(input: {
  currentPassword: unknown;
  newPassword: unknown;
  confirmPassword: unknown;
}): Promise<AuthActionResult> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the fields and try again." };
  }

  const { currentPassword, newPassword, confirmPassword } = parsed.data;

  if (!isAcceptablePassword(newPassword)) {
    return { ok: false, error: "Enter a new password." };
  }

  if (newPassword !== confirmPassword) {
    return { ok: false, error: "New passwords don’t match." };
  }

  try {
    const session = await requireAuthorizedUser();
    const hashToCheck = session.user.passwordHash;
    if (!hashToCheck) {
      return { ok: false, error: "Unable to change password right now." };
    }

    const currentOk = await verifyPassword(currentPassword, hashToCheck);
    if (!currentOk) {
      return { ok: false, error: "Current password isn’t right." };
    }

    const nextHash = await hashPassword(newPassword);
    await updateUserPasswordHash(session.user.id, nextHash);
    return { ok: true };
  } catch (error) {
    // Next.js redirect() throws — let it through.
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest?: unknown }).digest === "string" &&
      (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    return { ok: false, error: "Unable to change password right now." };
  }
}

export async function logout(): Promise<void> {
  const token = await readSessionCookie();
  if (token) {
    try {
      await revokeSessionByToken(token);
    } catch {
      // Still clear the cookie.
    }
  }
  await clearSessionCookie();
  await clearLockCookies();
  redirect("/login");
}
