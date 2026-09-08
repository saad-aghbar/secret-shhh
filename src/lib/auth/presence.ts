import { and, desc, eq, gt, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";

/** Consider online if we got a heartbeat within this window. */
export const PRESENCE_ONLINE_MS = 45_000;
export const PRESENCE_RECENT_MS = 15 * 60 * 1000;

export type PresenceStatus = "online" | "recently_active" | "offline" | "unknown";

export type PartnerPresence = {
  userId: string | null;
  displayName: string;
  status: PresenceStatus;
  lastSeenAt: string | null;
};

export function presenceFromLastSeen(lastSeenAt: Date | null | undefined): PresenceStatus {
  if (!lastSeenAt) {
    return "offline";
  }
  const age = Date.now() - lastSeenAt.getTime();
  if (age <= PRESENCE_ONLINE_MS) {
    return "online";
  }
  if (age <= PRESENCE_RECENT_MS) {
    return "recently_active";
  }
  return "offline";
}

export function presenceLabel(status: PresenceStatus): string {
  if (status === "online") {
    return "Online";
  }
  if (status === "recently_active") {
    return "Recently active";
  }
  if (status === "unknown") {
    return "Offline";
  }
  return "Offline";
}

export async function getPartnerPresence(partnerUserId: string | null): Promise<PartnerPresence> {
  if (!partnerUserId) {
    return {
      userId: null,
      displayName: "your person",
      status: "unknown",
      lastSeenAt: null,
    };
  }

  const db = getDb();
  const partner = (
    await db.select().from(users).where(eq(users.id, partnerUserId)).limit(1)
  )[0];

  if (!partner) {
    return {
      userId: partnerUserId,
      displayName: "your person",
      status: "unknown",
      lastSeenAt: null,
    };
  }

  const now = new Date();
  const latest = (
    await db
      .select({ lastSeenAt: sessions.lastSeenAt })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, partnerUserId),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, now),
        ),
      )
      .orderBy(desc(sessions.lastSeenAt))
      .limit(1)
  )[0];

  return {
    userId: partner.id,
    displayName: partner.displayName,
    status: presenceFromLastSeen(latest?.lastSeenAt),
    lastSeenAt: latest?.lastSeenAt?.toISOString() ?? null,
  };
}
