import { cookies } from "next/headers";

export const LOCK_COOKIE = "shhh_lock";
export const HIDDEN_AT_COOKIE = "shhh_hidden_at";

export function lockCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export async function readLockCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(LOCK_COOKIE)?.value ?? null;
}

export async function readHiddenAtCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(HIDDEN_AT_COOKIE)?.value ?? null;
}

export async function setLockCookie() {
  const jar = await cookies();
  jar.set(LOCK_COOKIE, "1", lockCookieOptions(60 * 60 * 24 * 30));
  jar.set(HIDDEN_AT_COOKIE, "", lockCookieOptions(0));
}

export async function setHiddenAtCookie(atMs = Date.now()) {
  const jar = await cookies();
  jar.set(HIDDEN_AT_COOKIE, String(atMs), lockCookieOptions(60 * 60 * 24));
}

export async function clearHiddenAtCookie() {
  const jar = await cookies();
  jar.set(HIDDEN_AT_COOKIE, "", lockCookieOptions(0));
}

export async function clearLockCookies() {
  const jar = await cookies();
  jar.set(LOCK_COOKIE, "", lockCookieOptions(0));
  jar.set(HIDDEN_AT_COOKIE, "", lockCookieOptions(0));
}
