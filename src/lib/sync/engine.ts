import type { ChatMessage } from "@/lib/chat/types";
import { isUnsendableStickerError } from "@/lib/http/client-error";
import { backoffMs, MAX_AUTO_RETRIES } from "@/lib/sync/backoff";
import { draftKey, getChatDb } from "@/lib/sync/db";
import {
  apiClearReaction,
  apiDeleteMessage,
  apiEditMessage,
  apiGetAfter,
  apiGetBefore,
  apiGetMessageContext,
  apiGetRecent,
  apiQueryReceipts,
  apiSendMessage,
  apiSetReaction,
} from "@/lib/sync/api";
import {
  applyReceiptPatches,
  mergeMessages,
  mutationKey,
  type PendingMessage,
  type PendingMutation,
  type ReceiptPatch,
  upsertMessage,
} from "@/lib/sync/merge";

export async function hydrateLocalThread(conversationId: string) {
  const db = getChatDb();
  const cached = await db.cachedMessages.where("conversationId").equals(conversationId).toArray();
  const pending = await db.pendingMessages.where("conversationId").equals(conversationId).toArray();
  const sync = await db.syncState.get(conversationId);
  return {
    messages: mergeMessages(cached, pending),
    pending,
    lastServerMessageId: sync?.lastServerMessageId ?? null,
  };
}

export async function putCachedMessages(rows: ChatMessage[]) {
  if (rows.length === 0) {
    return;
  }
  try {
    const db = getChatDb();
    await db.cachedMessages.bulkPut(rows);
  } catch {
    // Cache is a hint. A clone failure must not swallow a live sync.
  }
}

export async function rememberNewest(conversationId: string, newestId: string | null) {
  if (!newestId) {
    return;
  }
  const db = getChatDb();
  await db.syncState.put({
    conversationId,
    lastServerMessageId: newestId,
    lastSyncedAt: new Date().toISOString(),
  });
}

export async function getDraft(conversationId: string, userId: string) {
  const db = getChatDb();
  const row = await db.drafts.get(draftKey(conversationId, userId));
  return row?.text ?? "";
}

export async function saveDraft(conversationId: string, userId: string, text: string) {
  const db = getChatDb();
  const id = draftKey(conversationId, userId);
  if (!text) {
    await db.drafts.delete(id);
    return;
  }
  await db.drafts.put({
    id,
    conversationId,
    userId,
    text,
    updatedAt: new Date().toISOString(),
  });
}

export async function enqueueOutgoing(pending: PendingMessage) {
  const db = getChatDb();
  await db.pendingMessages.put(pending);
}

export async function updatePending(clientGeneratedId: string, patch: Partial<PendingMessage>) {
  const db = getChatDb();
  const current = await db.pendingMessages.get(clientGeneratedId);
  if (!current) {
    return;
  }
  await db.pendingMessages.put({ ...current, ...patch });
}

export async function removePending(clientGeneratedId: string) {
  const db = getChatDb();
  await db.pendingMessages.delete(clientGeneratedId);
}

export const OUTBOX_CHANGED_EVENT = "shhh:outbox";

function notifyOutboxChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OUTBOX_CHANGED_EVENT));
}

const inFlight = new Set<string>();

/** Stop a deleted sticker from retrying in the send queue. */
export async function dropPendingStickerSends(stickerId: string) {
  const db = getChatDb();
  const pending = await db.pendingMessages.toArray();
  let dropped = false;
  for (const item of pending) {
    if (item.stickerId !== stickerId) continue;
    inFlight.delete(item.clientGeneratedId);
    await db.pendingMessages.delete(item.clientGeneratedId);
    dropped = true;
  }
  if (dropped) notifyOutboxChanged();
}

export async function loadRecentIntoCache(conversationId: string) {
  const page = await apiGetRecent();
  await putCachedMessages(page.messages);
  await rememberNewest(conversationId, page.newestId);
  return page;
}

export async function loadOlderIntoCache(conversationId: string, cursor: string) {
  const page = await apiGetBefore(cursor);
  await putCachedMessages(page.messages);
  return page;
}

/** Seed Dexie + return a mid-history window around a target message. */
export async function loadAroundIntoCache(messageId: string) {
  const context = await apiGetMessageContext(messageId, 30, 30);
  const window = [...context.before, context.target, ...context.after];
  await putCachedMessages(window);
  return {
    ...context,
    messages: window,
    hasMoreOlder: Boolean(context.olderCursor),
  };
}

/**
 * Reconnect sync: never assume realtime delivered every event.
 * Fetch messages newer than the last authoritative cursor and reconcile.
 */
export async function syncAfterCursor(conversationId: string, cursorId: string | null) {
  if (!cursorId) {
    return loadRecentIntoCache(conversationId);
  }
  const page = await apiGetAfter(cursorId);
  const newest = page.newestId ?? cursorId;
  await putCachedMessages(page.messages);
  await rememberNewest(conversationId, newest);
  return page;
}

export async function flushPendingQueue(conversationId: string): Promise<ChatMessage[]> {
  const db = getChatDb();
  const pending = await db.pendingMessages.where("conversationId").equals(conversationId).toArray();
  const acked: ChatMessage[] = [];

  for (const item of pending.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (item.status === "preparing") {
      continue;
    }
    // Failed text waits for tap-to-retry. Failed stickers are attempted once so a
    // deleted definition can be dropped instead of retrying forever.
    if (item.status === "failed" && !item.stickerId) {
      continue;
    }
    const result = await sendPendingOnce(item);
    if (result) {
      acked.push(result);
    }
  }

  return acked;
}

export async function sendPendingOnce(item: PendingMessage): Promise<ChatMessage | null> {
  if (inFlight.has(item.clientGeneratedId)) {
    return null;
  }
  inFlight.add(item.clientGeneratedId);
  await updatePending(item.clientGeneratedId, { status: "sending" });
  try {
    const message = await apiSendMessage({
      text: item.stickerId || item.doodle ? undefined : item.textContent,
      stickerId: item.stickerId,
      doodle: item.doodle?.document,
      clientGeneratedId: item.clientGeneratedId,
      replyToMessageId: item.replyToMessageId,
    });
    await putCachedMessages([message]);
    await rememberNewest(item.conversationId, message.id);
    await removePending(item.clientGeneratedId);
    return message;
  } catch (error) {
    const code = (error as Error & { code?: string }).code;
    // Deterministic e2e failure — skip backoff ladder and surface Tap to retry.
    if (code === "FORCE_FAIL") {
      await updatePending(item.clientGeneratedId, {
        status: "failed",
        retryCount: MAX_AUTO_RETRIES,
      });
      return null;
    }
    if (isUnsendableStickerError(error, item.stickerId)) {
      await removePending(item.clientGeneratedId);
      notifyOutboxChanged();
      return null;
    }
    const nextCount = item.retryCount + 1;
    await updatePending(item.clientGeneratedId, {
      status: nextCount >= MAX_AUTO_RETRIES ? "failed" : "queued",
      retryCount: nextCount,
    });
    return null;
  } finally {
    inFlight.delete(item.clientGeneratedId);
  }
}

export async function patchCachedReceipts(patches: ReceiptPatch[]) {
  if (patches.length === 0) {
    return;
  }
  const db = getChatDb();
  for (const patch of patches) {
    const existing = await db.cachedMessages.get(patch.messageId);
    if (!existing) {
      continue;
    }
    await db.cachedMessages.put({
      ...existing,
      deliveredAt: patch.deliveredAt !== undefined ? patch.deliveredAt : existing.deliveredAt,
      readAt: patch.readAt !== undefined ? patch.readAt : existing.readAt,
    });
  }
}

export async function refreshOutgoingReceipts(messageIds: string[]): Promise<ReceiptPatch[]> {
  const receipts = await apiQueryReceipts(messageIds);
  const patches: ReceiptPatch[] = receipts.map((row) => ({
    messageId: row.messageId,
    deliveredAt: row.deliveredAt,
    readAt: row.readAt,
  }));
  await patchCachedReceipts(patches);
  return patches;
}

export { backoffMs, MAX_AUTO_RETRIES, applyReceiptPatches };

export function applyIncoming(existing: ChatMessage[], incoming: ChatMessage) {
  return upsertMessage(existing, incoming);
}

export async function patchCachedMessage(message: ChatMessage) {
  await putCachedMessages([message]);
}

export async function listPendingMutations() {
  const db = getChatDb();
  return db.pendingMutations.toArray();
}

export async function enqueueMutation(mutation: PendingMutation) {
  const db = getChatDb();
  await db.pendingMutations.put(mutation);
}

export async function removeMutation(id: string) {
  const db = getChatDb();
  await db.pendingMutations.delete(id);
}

export async function updateMutation(id: string, patch: Partial<PendingMutation>) {
  const db = getChatDb();
  const current = await db.pendingMutations.get(id);
  if (!current) return;
  await db.pendingMutations.put({ ...current, ...patch });
}

const mutationInFlight = new Set<string>();

export async function sendMutationOnce(item: PendingMutation): Promise<ChatMessage | null> {
  if (mutationInFlight.has(item.id)) {
    return null;
  }
  mutationInFlight.add(item.id);
  await updateMutation(item.id, { status: "sending" });
  try {
    let message: ChatMessage;
    if (item.kind === "edit") {
      message = await apiEditMessage(item.messageId, item.payload.text ?? "");
    } else if (item.kind === "delete") {
      message = await apiDeleteMessage(item.messageId);
    } else if (item.kind === "reaction-set") {
      message = await apiSetReaction(item.messageId, item.payload.emoji ?? "");
    } else {
      message = await apiClearReaction(item.messageId);
    }
    await putCachedMessages([message]);
    await removeMutation(item.id);
    return message;
  } catch {
    const nextCount = item.retryCount + 1;
    await updateMutation(item.id, {
      status: nextCount >= MAX_AUTO_RETRIES ? "failed" : "queued",
      retryCount: nextCount,
    });
    return null;
  } finally {
    mutationInFlight.delete(item.id);
  }
}

export async function flushPendingMutations(): Promise<ChatMessage[]> {
  const pending = await listPendingMutations();
  const acked: ChatMessage[] = [];
  for (const item of pending.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const result = await sendMutationOnce(item);
    if (result) acked.push(result);
  }
  return acked;
}

export async function fetchMessageById(messageId: string): Promise<ChatMessage | null> {
  try {
    const context = await apiGetMessageContext(messageId, 0, 0);
    await putCachedMessages([context.target]);
    return context.target;
  } catch {
    return null;
  }
}

export { mutationKey };
