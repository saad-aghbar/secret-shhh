import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, or } from "drizzle-orm";

import { getConversationPartnerId } from "@/lib/chat/access";
import { getMessageById } from "@/lib/chat/queries";
import {
  CALL_RING_TIMEOUT_MS,
  CALL_STALE_CONNECTED_MS,
  CALL_STALE_CONNECTING_MS,
  LIVE_CALL_STATUSES,
  type CallRecord,
  type CallStatus,
  type CallType,
  type CallView,
  isLiveCallStatus,
  normalizeCallStatus,
  outcomeFromStatus,
} from "@/lib/calls/config";
import { callDurationMs } from "@/lib/calls/duration";
import { CallError } from "@/lib/calls/errors";
import { type CallEventMeta, callEventTitle } from "@/lib/calls/events";
import { canTransition, endReasonFor, nextStatus, type CallAction } from "@/lib/calls/machine";
import { assertCallStartAllowed } from "@/lib/calls/rate-limit";
import { callRoomName } from "@/lib/calls/room";
import { getDb } from "@/lib/db";
import { calls, messageReceipts, messages } from "@/lib/db/schema";
import { logInfo } from "@/lib/logger";
import { broadcastConversationEvent } from "@/lib/realtime/broadcast";

export type { CallView };

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function callMetadata(row: typeof calls.$inferSelect) {
  return row.metadata && typeof row.metadata === "object" ? row.metadata : {};
}

function asRecord(row: typeof calls.$inferSelect): CallRecord {
  const meta = callMetadata(row);
  return {
    id: row.id,
    conversationId: row.conversationId ?? "",
    callerId: row.startedBy,
    calleeId: row.calleeId ?? "",
    type: row.type,
    roomName: row.roomName ?? callRoomName(row.id),
    status: normalizeCallStatus(row.status),
    createdAt: row.createdAt.toISOString(),
    ringingAt: (row.ringingAt ?? row.startedAt).toISOString(),
    answeredAt: iso(row.answeredAt),
    endedAt: iso(row.endedAt),
    endedBy: row.endedBy,
    endReason: row.endReason,
    durationMs: row.durationMs,
    videoUpgradedBy: typeof meta.videoUpgradedBy === "string" ? meta.videoUpgradedBy : null,
  };
}

function viewFor(row: typeof calls.$inferSelect, userId: string): CallView {
  const record = asRecord(row);
  return {
    ...record,
    role: record.callerId === userId ? "caller" : "callee",
  };
}

function assertParticipant(row: typeof calls.$inferSelect, userId: string) {
  if (row.startedBy !== userId && row.calleeId !== userId) {
    throw new CallError("FORBIDDEN", "You can’t join this call.", 403);
  }
}

async function loadCall(callId: string) {
  const db = getDb();
  const row = (await db.select().from(calls).where(eq(calls.id, callId)).limit(1))[0];
  if (!row) throw new CallError("NOT_FOUND", "That call isn’t here anymore.", 404);
  return row;
}

async function expireStaleCalls(conversationId: string) {
  const db = getDb();
  const now = Date.now();
  const live = await db
    .select()
    .from(calls)
    .where(and(eq(calls.conversationId, conversationId), inArray(calls.status, [...LIVE_CALL_STATUSES])));

  for (const row of live) {
    const ringingAt = (row.ringingAt ?? row.startedAt).getTime();
    if (row.status === "ringing" && now - ringingAt >= CALL_RING_TIMEOUT_MS) {
      await finalizeCall(row, "timeout", row.startedBy);
      continue;
    }
    if (row.status === "connecting" && now - (row.updatedAt?.getTime() ?? ringingAt) >= CALL_STALE_CONNECTING_MS) {
      await finalizeCall(row, "fail", row.startedBy);
      continue;
    }
    if (
      (row.status === "connected" || row.status === "reconnecting") &&
      now - (row.updatedAt?.getTime() ?? ringingAt) >= CALL_STALE_CONNECTED_MS
    ) {
      await finalizeCall(row, "fail", row.startedBy);
    }
  }
}

async function insertCallEvent(row: typeof calls.$inferSelect, outcomeStatus: CallStatus) {
  if (!row.conversationId) return;
  const db = getDb();
  const already = (
    await db
      .select({ id: messages.id, metadata: messages.metadata })
      .from(messages)
      .where(and(eq(messages.conversationId, row.conversationId), eq(messages.type, "call")))
  ).some((message) => {
    const meta = message.metadata as Record<string, unknown> | null;
    return meta?.callId === row.id;
  });
  if (already) return;

  const durationMs = callDurationMs(row.answeredAt, row.endedAt ?? new Date());
  const meta: CallEventMeta = {
    callId: row.id,
    callType: row.type,
    outcome: outcomeFromStatus(outcomeStatus),
    durationMs,
  };
  const title = callEventTitle(meta);
  const [message] = await db
    .insert(messages)
    .values({
      conversationId: row.conversationId,
      senderId: row.startedBy,
      clientGeneratedId: randomUUID(),
      type: "call",
      textContent: title,
      metadata: meta,
    })
    .returning();
  if (!message) return;
  if (row.calleeId) {
    await db
      .insert(messageReceipts)
      .values({ messageId: message.id, userId: row.calleeId })
      .onConflictDoNothing();
  }
  void broadcastConversationEvent(row.conversationId, "message:new", { messageId: message.id });
  void getMessageById(row.conversationId, row.startedBy, message.id);
}

async function finalizeCall(
  row: typeof calls.$inferSelect,
  action: CallAction,
  actorId: string,
): Promise<typeof calls.$inferSelect> {
  const next = nextStatus(row.status, action);
  if (!next) return row;
  const now = new Date();
  const endedAt = now;
  const durationMs = callDurationMs(row.answeredAt, endedAt);
  const db = getDb();
  const [updated] = await db
    .update(calls)
    .set({
      status: next,
      endedAt,
      endedBy: actorId,
      endReason: endReasonFor(action, row.status),
      durationMs,
      updatedAt: now,
    })
    .where(and(eq(calls.id, row.id), eq(calls.status, row.status)))
    .returning();
  const final = updated ?? (await loadCall(row.id));
  await insertCallEvent(final, normalizeCallStatus(final.status));
  if (final.conversationId) {
    const event =
      action === "decline"
        ? "call:declined"
        : action === "cancel"
          ? "call:cancelled"
          : action === "timeout"
            ? "call:ended"
            : "call:ended";
    void broadcastConversationEvent(final.conversationId, event, { callId: final.id });
  }
  return final;
}

export async function getActiveCall(params: {
  userId: string;
  conversationId: string;
}): Promise<CallView | null> {
  await expireStaleCalls(params.conversationId);
  const db = getDb();
  const row = (
    await db
      .select()
      .from(calls)
      .where(
        and(
          eq(calls.conversationId, params.conversationId),
          or(eq(calls.startedBy, params.userId), eq(calls.calleeId, params.userId)),
          inArray(calls.status, [...LIVE_CALL_STATUSES]),
        ),
      )
      .orderBy(desc(calls.createdAt))
      .limit(1)
  )[0];
  if (!row) return null;
  return viewFor(row, params.userId);
}

export async function getCallForUser(params: { userId: string; callId: string }): Promise<CallView> {
  const row = await loadCall(params.callId);
  assertParticipant(row, params.userId);
  if (row.conversationId) await expireStaleCalls(row.conversationId);
  return viewFor(await loadCall(params.callId), params.userId);
}

export async function startCall(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  type: CallType;
}): Promise<CallView> {
  await assertCallStartAllowed(params.userId);
  const partnerId = await getConversationPartnerId(params.conversationId, params.userId);
  if (!partnerId) {
    throw new CallError("FORBIDDEN", "You can’t start that call.", 403);
  }
  await expireStaleCalls(params.conversationId);

  const existing = await getActiveCall({
    userId: params.userId,
    conversationId: params.conversationId,
  });
  if (existing) {
    logInfo({
      requestId: params.requestId,
      operation: "calls.start.reconcile",
      userId: params.userId,
    });
    return existing;
  }

  const db = getDb();
  const now = new Date();
  const id = randomUUID();
  try {
    const [row] = await db
      .insert(calls)
      .values({
        id,
        conversationId: params.conversationId,
        startedBy: params.userId,
        calleeId: partnerId,
        type: params.type,
        roomName: callRoomName(id),
        status: "ringing",
        startedAt: now,
        ringingAt: now,
        metadata: {},
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!row) {
      throw new CallError("CONFLICT", "A call is already happening.", 409);
    }
    void broadcastConversationEvent(params.conversationId, "call:incoming", {
      callId: row.id,
      type: params.type,
    });
    logInfo({
      requestId: params.requestId,
      operation: "calls.start",
      userId: params.userId,
    });
    return viewFor(row, params.userId);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "23505") {
      const live = await getActiveCall({
        userId: params.userId,
        conversationId: params.conversationId,
      });
      if (live) return live;
      throw new CallError("CONFLICT", "A call is already happening.", 409);
    }
    throw error;
  }
}

export async function acceptCall(params: {
  requestId: string;
  userId: string;
  callId: string;
}): Promise<CallView> {
  const row = await loadCall(params.callId);
  assertParticipant(row, params.userId);
  if (row.startedBy === params.userId) {
    throw new CallError("FORBIDDEN", "You can’t answer your own call.", 403);
  }
  if (!canTransition(row.status, "accept")) {
    return viewFor(row, params.userId);
  }
  const now = new Date();
  const db = getDb();
  const [updated] = await db
    .update(calls)
    .set({
      status: "connecting",
      answeredAt: row.answeredAt ?? now,
      updatedAt: now,
    })
    .where(and(eq(calls.id, row.id), eq(calls.status, "ringing")))
    .returning();
  const final = updated ?? (await loadCall(params.callId));
  if (final.conversationId) {
    void broadcastConversationEvent(final.conversationId, "call:accepted", { callId: final.id });
  }
  logInfo({ requestId: params.requestId, operation: "calls.accept", userId: params.userId });
  return viewFor(final, params.userId);
}

export async function declineCall(params: {
  requestId: string;
  userId: string;
  callId: string;
}): Promise<CallView> {
  const row = await loadCall(params.callId);
  assertParticipant(row, params.userId);
  if (row.startedBy === params.userId) {
    throw new CallError("FORBIDDEN", "Use cancel to stop ringing.", 403);
  }
  const final = await finalizeCall(row, "decline", params.userId);
  logInfo({ requestId: params.requestId, operation: "calls.decline", userId: params.userId });
  return viewFor(final, params.userId);
}

export async function cancelCall(params: {
  requestId: string;
  userId: string;
  callId: string;
}): Promise<CallView> {
  const row = await loadCall(params.callId);
  assertParticipant(row, params.userId);
  if (row.startedBy !== params.userId) {
    throw new CallError("FORBIDDEN", "Only the caller can cancel.", 403);
  }
  const final = await finalizeCall(row, "cancel", params.userId);
  logInfo({ requestId: params.requestId, operation: "calls.cancel", userId: params.userId });
  return viewFor(final, params.userId);
}

export async function endCall(params: {
  requestId: string;
  userId: string;
  callId: string;
}): Promise<CallView> {
  const row = await loadCall(params.callId);
  assertParticipant(row, params.userId);
  if (!isLiveCallStatus(row.status)) {
    return viewFor(row, params.userId);
  }
  const action: CallAction = row.status === "ringing" ? (row.startedBy === params.userId ? "cancel" : "decline") : "end";
  const final = await finalizeCall(row, action, params.userId);
  logInfo({ requestId: params.requestId, operation: "calls.end", userId: params.userId });
  return viewFor(final, params.userId);
}

export async function markCallConnected(params: { userId: string; callId: string }): Promise<CallView> {
  const row = await loadCall(params.callId);
  assertParticipant(row, params.userId);
  if (!canTransition(row.status, "connect") && row.status !== "connected") {
    return viewFor(row, params.userId);
  }
  const db = getDb();
  const [updated] = await db
    .update(calls)
    .set({ status: "connected", updatedAt: new Date() })
    .where(
      and(
        eq(calls.id, row.id),
        inArray(calls.status, ["connecting", "reconnecting", "connected"]),
      ),
    )
    .returning();
  return viewFor(updated ?? row, params.userId);
}

export async function markCallReconnecting(params: { userId: string; callId: string }): Promise<CallView> {
  const row = await loadCall(params.callId);
  assertParticipant(row, params.userId);
  if (!canTransition(row.status, "reconnect")) return viewFor(row, params.userId);
  const db = getDb();
  const [updated] = await db
    .update(calls)
    .set({ status: "reconnecting", updatedAt: new Date() })
    .where(and(eq(calls.id, row.id), inArray(calls.status, ["connecting", "connected"])))
    .returning();
  if (row.conversationId) {
    void broadcastConversationEvent(row.conversationId, "call:updated", { callId: row.id });
  }
  return viewFor(updated ?? row, params.userId);
}

export async function failCall(params: { userId: string; callId: string }): Promise<CallView> {
  const row = await loadCall(params.callId);
  assertParticipant(row, params.userId);
  const final = await finalizeCall(row, "fail", params.userId);
  return viewFor(final, params.userId);
}

export async function upgradeCallToVideo(params: {
  requestId: string;
  userId: string;
  callId: string;
}): Promise<CallView> {
  const row = await loadCall(params.callId);
  assertParticipant(row, params.userId);
  if (row.type === "video") {
    if (!isLiveCallStatus(row.status)) {
      throw new CallError("CONFLICT", "That call has already ended.", 409);
    }
    return viewFor(row, params.userId);
  }
  if (!canTransition(row.status, "upgrade")) {
    throw new CallError("CONFLICT", "That call isn’t ready for video yet.", 409);
  }
  const now = new Date();
  const meta = {
    ...callMetadata(row),
    videoUpgradedBy: params.userId,
    videoUpgradedAt: now.toISOString(),
    upgradedFrom: "audio",
  };
  const db = getDb();
  const [updated] = await db
    .update(calls)
    .set({
      type: "video",
      metadata: meta,
      updatedAt: now,
    })
    .where(
      and(
        eq(calls.id, row.id),
        inArray(calls.status, ["connecting", "connected", "reconnecting"]),
      ),
    )
    .returning();
  const final = updated ?? (await loadCall(params.callId));
  if (final.conversationId) {
    void broadcastConversationEvent(final.conversationId, "call:updated", { callId: final.id });
  }
  logInfo({ requestId: params.requestId, operation: "calls.upgrade", userId: params.userId });
  return viewFor(final, params.userId);
}
