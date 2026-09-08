import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { bootstrapUserBySlot, type BootstrapResult } from "@/lib/auth/bootstrap";
import { clearSessionCookie, readSessionCookie } from "@/lib/auth/cookies";
import { profileSlotSchema, type ProfileSlot } from "@/lib/auth/profiles";
import { findValidSession, touchSession } from "@/lib/auth/session-store";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

export type AuthorizedSession = BootstrapResult & {
  sessionId: string;
  slot: ProfileSlot;
};

export async function getSessionToken(): Promise<string | null> {
  return readSessionCookie();
}

export async function resolveAuthorizedSession(): Promise<AuthorizedSession | null> {
  const token = await readSessionCookie();
  if (!token) {
    return null;
  }

  let session;
  try {
    session = await findValidSession(token);
  } catch {
    return null;
  }

  if (!session) {
    await clearSessionCookie();
    return null;
  }

  const db = getDb();
  const user = (
    await db.select().from(users).where(eq(users.id, session.userId)).limit(1)
  )[0];

  if (!user) {
    await clearSessionCookie();
    return null;
  }

  const slotParsed = profileSlotSchema.safeParse(user.profileSlot);
  if (!slotParsed.success) {
    await clearSessionCookie();
    return null;
  }

  await touchSession(session.id);
  const bootstrapped = await bootstrapUserBySlot({
    slot: slotParsed.data,
    displayName: user.displayName,
  });

  return {
    ...bootstrapped,
    sessionId: session.id,
    slot: slotParsed.data,
  };
}

export async function requireAuthorizedUser(): Promise<AuthorizedSession> {
  const session = await resolveAuthorizedSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function getOptionalAuthorizedUser(): Promise<AuthorizedSession | null> {
  return resolveAuthorizedSession();
}
