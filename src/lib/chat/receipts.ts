import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import { getConversationPartnerId } from "@/lib/chat/access";
import { getDb } from "@/lib/db";
import { messageReceipts, messages } from "@/lib/db/schema";
import { logInfo } from "@/lib/logger";
import { broadcastConversationEvent } from "@/lib/realtime/broadcast";

export type OutgoingReceiptState = {
  messageId: string;
  deliveredAt: string | null;
  readAt: string | null;
};

async function eligibleIncomingIds(conversationId: string, userId: string, messageIds: string[]) {
  if (messageIds.length === 0) {
    return [];
  }
  const db = getDb();
  const rows = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        inArray(messages.id, messageIds),
        ne(messages.senderId, userId),
        isNull(messages.deletedAt),
      ),
    );
  return rows.map((row) => row.id);
}

async function idsNeedingDelivered(userId: string, messageIds: string[]) {
  if (messageIds.length === 0) {
    return [];
  }
  const db = getDb();
  const existing = await db
    .select({
      messageId: messageReceipts.messageId,
      deliveredAt: messageReceipts.deliveredAt,
    })
    .from(messageReceipts)
    .where(
      and(eq(messageReceipts.userId, userId), inArray(messageReceipts.messageId, messageIds)),
    );
  const delivered = new Set(
    existing.filter((row) => row.deliveredAt != null).map((row) => row.messageId),
  );
  return messageIds.filter((id) => !delivered.has(id));
}

async function idsNeedingRead(userId: string, messageIds: string[]) {
  if (messageIds.length === 0) {
    return [];
  }
  const db = getDb();
  const existing = await db
    .select({
      messageId: messageReceipts.messageId,
      readAt: messageReceipts.readAt,
    })
    .from(messageReceipts)
    .where(
      and(eq(messageReceipts.userId, userId), inArray(messageReceipts.messageId, messageIds)),
    );
  const read = new Set(existing.filter((row) => row.readAt != null).map((row) => row.messageId));
  return messageIds.filter((id) => !read.has(id));
}

export async function markMessagesDelivered(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  messageIds: string[];
}): Promise<{ updated: number }> {
  const eligible = await eligibleIncomingIds(params.conversationId, params.userId, params.messageIds);
  const ids = await idsNeedingDelivered(params.userId, eligible);
  if (ids.length === 0) {
    return { updated: 0 };
  }

  const db = getDb();
  const now = new Date();
  const values = ids.map((id) => ({
    messageId: id,
    userId: params.userId,
    deliveredAt: now,
  }));

  await db
    .insert(messageReceipts)
    .values(values)
    .onConflictDoUpdate({
      target: [messageReceipts.messageId, messageReceipts.userId],
      set: {
        deliveredAt: sql`coalesce(${messageReceipts.deliveredAt}, ${now})`,
      },
    });

  logInfo({
    requestId: params.requestId,
    operation: "markDelivered",
    userId: params.userId,
    extra: { count: ids.length },
  });

  const iso = now.toISOString();
  void broadcastConversationEvent(params.conversationId, "receipt:update", {
    kind: "delivered",
    messageIds: ids,
    deliveredAt: iso,
  });

  return { updated: ids.length };
}

export async function markMessagesRead(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  messageIds: string[];
}): Promise<{ updated: number }> {
  const eligible = await eligibleIncomingIds(params.conversationId, params.userId, params.messageIds);
  const ids = await idsNeedingRead(params.userId, eligible);
  if (ids.length === 0) {
    return { updated: 0 };
  }

  const db = getDb();
  const now = new Date();
  const values = ids.map((id) => ({
    messageId: id,
    userId: params.userId,
    deliveredAt: now,
    readAt: now,
  }));

  await db
    .insert(messageReceipts)
    .values(values)
    .onConflictDoUpdate({
      target: [messageReceipts.messageId, messageReceipts.userId],
      set: {
        deliveredAt: sql`coalesce(${messageReceipts.deliveredAt}, ${now})`,
        readAt: sql`coalesce(${messageReceipts.readAt}, ${now})`,
      },
    });

  logInfo({
    requestId: params.requestId,
    operation: "markRead",
    userId: params.userId,
    extra: { count: ids.length },
  });

  const iso = now.toISOString();
  void broadcastConversationEvent(params.conversationId, "receipt:update", {
    kind: "read",
    messageIds: ids,
    deliveredAt: iso,
    readAt: iso,
  });

  return { updated: ids.length };
}

/**
 * Partner receipt state for messages the viewer sent — for live Sent→Delivered→Read.
 */
export async function getOutgoingReceiptStates(params: {
  userId: string;
  conversationId: string;
  messageIds: string[];
}): Promise<OutgoingReceiptState[]> {
  if (params.messageIds.length === 0) {
    return [];
  }

  const partnerId = await getConversationPartnerId(params.conversationId, params.userId);
  if (!partnerId) {
    return params.messageIds.map((messageId) => ({
      messageId,
      deliveredAt: null,
      readAt: null,
    }));
  }

  const db = getDb();
  const owned = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, params.conversationId),
        eq(messages.senderId, params.userId),
        inArray(messages.id, params.messageIds),
      ),
    );
  const ownedIds = owned.map((row) => row.id);
  if (ownedIds.length === 0) {
    return [];
  }

  const receipts = await db
    .select({
      messageId: messageReceipts.messageId,
      deliveredAt: messageReceipts.deliveredAt,
      readAt: messageReceipts.readAt,
    })
    .from(messageReceipts)
    .where(
      and(eq(messageReceipts.userId, partnerId), inArray(messageReceipts.messageId, ownedIds)),
    );

  const byId = new Map(receipts.map((row) => [row.messageId, row]));
  return ownedIds
    .map((messageId) => {
      const row = byId.get(messageId);
      if (!row) {
        return null;
      }
      return {
        messageId,
        deliveredAt: row.deliveredAt?.toISOString() ?? null,
        readAt: row.readAt?.toISOString() ?? null,
      };
    })
    .filter((row): row is OutgoingReceiptState => row != null);
}
