import { createHash, randomBytes } from "node:crypto";

import { and, eq, gt, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { getServerEnv } from "@/lib/env";

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashOpaque(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createSession(params: {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const env = getServerEnv();
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + env.AUTH_SESSION_DAYS * 24 * 60 * 60 * 1000);

  const db = getDb();
  const [row] = await db
    .insert(sessions)
    .values({
      userId: params.userId,
      tokenHash,
      expiresAt,
      createdAt: now,
      lastSeenAt: now,
      ipHash: params.ip ? hashOpaque(params.ip) : null,
      userAgentHash: params.userAgent ? hashOpaque(params.userAgent) : null,
    })
    .returning();

  return { token, session: row };
}

export async function findValidSession(token: string) {
  const tokenHash = hashSessionToken(token);
  const db = getDb();
  const now = new Date();

  const row = (
    await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, now),
        ),
      )
      .limit(1)
  )[0];

  return row ?? null;
}

/** Rolling expiration: extend on activity. */
export async function touchSession(sessionId: string) {
  const env = getServerEnv();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + env.AUTH_SESSION_DAYS * 24 * 60 * 60 * 1000);
  const db = getDb();

  await db
    .update(sessions)
    .set({ lastSeenAt: now, expiresAt })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
}

export async function revokeSessionByToken(token: string) {
  const tokenHash = hashSessionToken(token);
  const db = getDb();
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.tokenHash, tokenHash));
}

export async function revokeSessionById(sessionId: string) {
  const db = getDb();
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.id, sessionId));
}
