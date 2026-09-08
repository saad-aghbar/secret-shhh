"use server";

import {
  getPartnerPresence,
  type PartnerPresence,
} from "@/lib/auth/presence";
import { requireAuthorizedUser } from "@/lib/auth/session";
import { touchSession } from "@/lib/auth/session-store";

export async function sendPresenceHeartbeat(): Promise<{ ok: true } | { ok: false }> {
  try {
    const session = await requireAuthorizedUser();
    await touchSession(session.sessionId);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function fetchPartnerPresence(): Promise<PartnerPresence | null> {
  try {
    const session = await requireAuthorizedUser();
    return getPartnerPresence(session.partner?.id ?? null);
  } catch {
    return null;
  }
}
