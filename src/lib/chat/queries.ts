import { and, desc, eq, gt, inArray, lt, ne, or } from "drizzle-orm";

import { getConversationPartnerId } from "@/lib/chat/access";
import { buildReplyPreview } from "@/lib/chat/reply-preview";
import { asChatType, compareMessages, serializeMessage } from "@/lib/chat/serialize";
import type { ChatMessage, MessagePage, MessageReaction, ReplyPreview } from "@/lib/chat/types";
import { MESSAGE_PAGE_SIZE } from "@/lib/chat/types";
import { getDb } from "@/lib/db";
import { messageMedia, messageReceipts, messages, reactions } from "@/lib/db/schema";
import { loadDoodlesForMessages } from "@/lib/doodles/service";
import { loadMediaForMessages } from "@/lib/media/service";
import { loadMusicForMessages } from "@/lib/music/message-load";
import { loadStickersForMessages } from "@/lib/stickers/service";

const VISIBLE_MESSAGE_TYPES = ["text", "image", "video", "audio", "sticker", "doodle", "call", "music"] as const;

type Cursor = { createdAt: Date; id: string };

async function loadCursor(conversationId: string, cursorId: string): Promise<Cursor | null> {
  const db = getDb();
  const row = (
    await db
      .select({ id: messages.id, createdAt: messages.createdAt })
      .from(messages)
      .where(and(eq(messages.id, cursorId), eq(messages.conversationId, conversationId)))
      .limit(1)
  )[0];
  return row ?? null;
}

/**
 * Receipt we care about for the viewer:
 * outgoing → partner's delivered/read
 * incoming → viewer's delivered/read
 */
function receiptUserId(senderId: string, viewerId: string, partnerId: string | null) {
  if (senderId === viewerId) {
    return partnerId;
  }
  return viewerId;
}

async function loadReplyPreviews(
  rows: (typeof messages.$inferSelect)[],
  viewerId: string,
): Promise<Map<string, ReplyPreview>> {
  const ids = [
    ...new Set(rows.map((row) => row.replyToMessageId).filter((id): id is string => Boolean(id))),
  ];
  const map = new Map<string, ReplyPreview>();
  if (ids.length === 0) {
    return map;
  }

  const db = getDb();
  const targets = await db.select().from(messages).where(inArray(messages.id, ids));
  const liveIds = targets.filter((row) => !row.deletedAt).map((row) => row.id);
  const [stickerById, doodleByMessage, musicByMessage] = await Promise.all([
    loadStickersForMessages(targets.map((row) => row.stickerId)),
    loadDoodlesForMessages(targets.map((row) => row.id)),
    loadMusicForMessages(liveIds, viewerId),
  ]);
  const mediaRows =
    liveIds.length === 0
      ? []
      : await db
          .select({
            messageId: messageMedia.messageId,
            id: messageMedia.id,
            durationMs: messageMedia.durationMs,
            sortOrder: messageMedia.sortOrder,
          })
          .from(messageMedia)
          .where(and(inArray(messageMedia.messageId, liveIds), eq(messageMedia.uploadStatus, "ready")));

  const firstMedia = new Map<string, { id: string; durationMs: number | null }>();
  for (const row of mediaRows.sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (!firstMedia.has(row.messageId)) {
      firstMedia.set(row.messageId, { id: row.id, durationMs: row.durationMs });
    }
  }

  for (const target of targets) {
    const media = target.deletedAt ? undefined : firstMedia.get(target.id);
    map.set(
      target.id,
      buildReplyPreview({
        id: target.id,
        senderId: target.senderId,
        type: asChatType(target.type),
        textContent: target.textContent,
        deletedAt: target.deletedAt,
        mediaPreviewId: media?.id ?? null,
        durationMs: media?.durationMs ?? null,
        sticker: target.stickerId ? (stickerById.get(target.stickerId) ?? null) : null,
        doodle: doodleByMessage.get(target.id) ?? null,
        music: musicByMessage.get(target.id) ?? null,
      }),
    );
  }

  for (const id of ids) {
    if (!map.has(id)) {
      map.set(id, buildReplyPreview({
        id,
        senderId: "",
        type: "text",
        textContent: null,
        deletedAt: new Date(),
      }));
    }
  }

  return map;
}

async function loadReactions(ids: string[]): Promise<Map<string, MessageReaction[]>> {
  const map = new Map<string, MessageReaction[]>();
  if (ids.length === 0) {
    return map;
  }
  const db = getDb();
  const rows = await db.select().from(reactions).where(inArray(reactions.messageId, ids));
  for (const row of rows) {
    const list = map.get(row.messageId) ?? [];
    list.push({
      userId: row.userId,
      emoji: row.emoji,
      createdAt: row.createdAt.toISOString(),
    });
    map.set(row.messageId, list);
  }
  return map;
}

export async function hydrateMessages(
  rows: (typeof messages.$inferSelect)[],
  viewerId: string,
  partnerId: string | null,
): Promise<ChatMessage[]> {
  if (rows.length === 0) {
    return [];
  }

  const db = getDb();
  const ids = rows.map((row) => row.id);
  const liveIds = rows.filter((row) => !row.deletedAt).map((row) => row.id);

  const [receiptRows, mediaByMessage, replyById, reactionsById, stickerById, doodleByMessage, musicByMessage] =
    await Promise.all([
      db.select().from(messageReceipts).where(inArray(messageReceipts.messageId, ids)),
      liveIds.length > 0 ? loadMediaForMessages(liveIds) : Promise.resolve(new Map()),
      loadReplyPreviews(rows, viewerId),
      loadReactions(liveIds),
      loadStickersForMessages(
        rows.map((row) => row.stickerId),
        viewerId,
      ),
      loadDoodlesForMessages(ids),
      liveIds.length > 0 ? loadMusicForMessages(liveIds, viewerId) : Promise.resolve(new Map()),
    ]);

  const byKey = new Map<string, (typeof receiptRows)[number]>();
  for (const receipt of receiptRows) {
    byKey.set(`${receipt.messageId}:${receipt.userId}`, receipt);
  }

  return rows.map((row) => {
    const userId = receiptUserId(row.senderId, viewerId, partnerId);
    const receipt = userId ? (byKey.get(`${row.id}:${userId}`) ?? null) : null;
    return serializeMessage(row, receipt, mediaByMessage.get(row.id) ?? [], {
      replyTo: row.replyToMessageId ? (replyById.get(row.replyToMessageId) ?? null) : null,
      reactions: reactionsById.get(row.id),
      sticker: row.stickerId ? (stickerById.get(row.stickerId) ?? null) : null,
      doodle: doodleByMessage.get(row.id) ?? null,
      music: musicByMessage.get(row.id) ?? null,
    });
  });
}

export async function getRecentMessages(
  conversationId: string,
  viewerId: string,
  limit = MESSAGE_PAGE_SIZE,
): Promise<MessagePage> {
  const db = getDb();
  const rows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        inArray(messages.type, [...VISIBLE_MESSAGE_TYPES]),
      ),
    )
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const partnerId = await getConversationPartnerId(conversationId, viewerId);
  const serialized = (await hydrateMessages(page, viewerId, partnerId)).sort(compareMessages);

  return {
    messages: serialized,
    nextBeforeCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    oldestId: serialized[0]?.id ?? null,
    newestId: serialized[serialized.length - 1]?.id ?? null,
  };
}

export async function getMessagesBefore(
  conversationId: string,
  viewerId: string,
  cursorId: string,
  limit = MESSAGE_PAGE_SIZE,
): Promise<MessagePage> {
  const cursor = await loadCursor(conversationId, cursorId);
  if (!cursor) {
    return { messages: [], nextBeforeCursor: null, oldestId: null, newestId: null };
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        inArray(messages.type, [...VISIBLE_MESSAGE_TYPES]),
        or(
          lt(messages.createdAt, cursor.createdAt),
          and(eq(messages.createdAt, cursor.createdAt), lt(messages.id, cursor.id)),
        ),
      ),
    )
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const partnerId = await getConversationPartnerId(conversationId, viewerId);
  const serialized = (await hydrateMessages(page, viewerId, partnerId)).sort(compareMessages);

  return {
    messages: serialized,
    nextBeforeCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    oldestId: serialized[0]?.id ?? null,
    newestId: serialized[serialized.length - 1]?.id ?? null,
  };
}

export async function getMessagesAfter(
  conversationId: string,
  viewerId: string,
  cursorId: string,
  limit = MESSAGE_PAGE_SIZE,
): Promise<MessagePage> {
  const cursor = await loadCursor(conversationId, cursorId);
  if (!cursor) {
    return getRecentMessages(conversationId, viewerId, limit);
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        inArray(messages.type, [...VISIBLE_MESSAGE_TYPES]),
        // Never return the cursor itself (Date precision can make the same
        // row look strictly newer than the JS Date we loaded it as).
        ne(messages.id, cursorId),
        or(
          gt(messages.createdAt, cursor.createdAt),
          and(eq(messages.createdAt, cursor.createdAt), gt(messages.id, cursor.id)),
        ),
      ),
    )
    .orderBy(messages.createdAt, messages.id)
    .limit(limit);

  const partnerId = await getConversationPartnerId(conversationId, viewerId);
  const serialized = await hydrateMessages(rows, viewerId, partnerId);

  return {
    messages: serialized,
    nextBeforeCursor: null,
    oldestId: serialized[0]?.id ?? null,
    newestId: serialized[serialized.length - 1]?.id ?? null,
  };
}

/**
 * Context window around a target message for Search/History jumps.
 * Default 30 before + 30 after — enough to orient without loading the whole thread.
 */
export async function getMessagesAround(
  conversationId: string,
  viewerId: string,
  messageId: string,
  options: { before?: number; after?: number } = {},
): Promise<{
  target: ChatMessage | null;
  before: ChatMessage[];
  after: ChatMessage[];
  olderCursor: string | null;
  newerCursor: string | null;
}> {
  const beforeLimit = options.before ?? 30;
  const afterLimit = options.after ?? 30;
  const target = await getMessageById(conversationId, viewerId, messageId);
  if (!target) {
    return { target: null, before: [], after: [], olderCursor: null, newerCursor: null };
  }

  const olderPage = await getMessagesBefore(conversationId, viewerId, messageId, beforeLimit);
  const newerPage = await getMessagesAfter(conversationId, viewerId, messageId, afterLimit);

  // getMessagesAfter returns ascending; before is sorted ascending via compareMessages.
  const before = olderPage.messages.filter((m) => m.id !== target.id);
  const after = newerPage.messages.filter((m) => m.id !== target.id);

  return {
    target,
    before,
    after,
    olderCursor: olderPage.nextBeforeCursor,
    newerCursor: after.length > 0 ? after[after.length - 1]!.id : target.id,
  };
}

export async function getMessageById(
  conversationId: string,
  viewerId: string,
  messageId: string,
): Promise<ChatMessage | null> {
  const db = getDb();
  const row = (
    await db
      .select()
      .from(messages)
      .where(and(eq(messages.id, messageId), eq(messages.conversationId, conversationId)))
      .limit(1)
  )[0];
  if (!row) {
    return null;
  }
  const partnerId = await getConversationPartnerId(conversationId, viewerId);
  const [serialized] = await hydrateMessages([row], viewerId, partnerId);
  return serialized ?? null;
}

export async function getMessageByClientGeneratedId(
  senderId: string,
  clientGeneratedId: string,
  viewerId: string,
): Promise<ChatMessage | null> {
  const db = getDb();
  const row = (
    await db
      .select()
      .from(messages)
      .where(
        and(eq(messages.senderId, senderId), eq(messages.clientGeneratedId, clientGeneratedId)),
      )
      .limit(1)
  )[0];
  if (!row) {
    return null;
  }
  const partnerId = await getConversationPartnerId(row.conversationId, viewerId);
  const [serialized] = await hydrateMessages([row], viewerId, partnerId);
  return serialized ?? null;
}
