import { and, eq } from "drizzle-orm";

import { getConversationPartnerId } from "@/lib/chat/access";
import { getMessageByClientGeneratedId, getMessageById } from "@/lib/chat/queries";
import { assertReplyTarget } from "@/lib/chat/reply-target";
import type { ChatMessage } from "@/lib/chat/types";
import { getDb } from "@/lib/db";
import { messageReceipts, messages } from "@/lib/db/schema";
import { logError, logInfo } from "@/lib/logger";
import { broadcastConversationEvent } from "@/lib/realtime/broadcast";

export class ChatValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatValidationError";
  }
}

/**
 * Inserts a text message. senderId + conversationId come from the session.
 * (senderId, clientGeneratedId) is idempotent — retries return the existing row.
 */
export async function sendTextMessage(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  text: string;
  clientGeneratedId: string;
  replyToMessageId?: string;
}): Promise<ChatMessage> {
  const started = Date.now();
  const db = getDb();
  const existing = await getMessageByClientGeneratedId(
    params.userId,
    params.clientGeneratedId,
    params.userId,
  );
  if (existing) {
    logInfo({
      requestId: params.requestId,
      operation: "sendTextMessage.idempotent",
      userId: params.userId,
      durationMs: Date.now() - started,
    });
    return existing;
  }

  if (params.replyToMessageId) {
    await assertReplyTarget({
      conversationId: params.conversationId,
      replyToMessageId: params.replyToMessageId,
    });
  }

  const partnerId = await getConversationPartnerId(params.conversationId, params.userId);

  try {
    const inserted = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(messages)
        .values({
          conversationId: params.conversationId,
          senderId: params.userId,
          clientGeneratedId: params.clientGeneratedId,
          type: "text",
          textContent: params.text,
          replyToMessageId: params.replyToMessageId,
          metadata: {},
        })
        .onConflictDoNothing({
          target: [messages.senderId, messages.clientGeneratedId],
        })
        .returning();

      const message =
        row ??
        (
          await tx
            .select()
            .from(messages)
            .where(
              and(
                eq(messages.senderId, params.userId),
                eq(messages.clientGeneratedId, params.clientGeneratedId),
              ),
            )
            .limit(1)
        )[0];

      if (!message) {
        throw new Error("insert_failed");
      }

      if (partnerId && row) {
        await tx
          .insert(messageReceipts)
          .values({
            messageId: message.id,
            userId: partnerId,
          })
          .onConflictDoNothing({
            target: [messageReceipts.messageId, messageReceipts.userId],
          });
      }

      return message;
    });

    const serialized =
      (await getMessageById(params.conversationId, params.userId, inserted.id)) ??
      (await getMessageByClientGeneratedId(
        params.userId,
        params.clientGeneratedId,
        params.userId,
      ))!;

    logInfo({
      requestId: params.requestId,
      operation: "sendTextMessage",
      userId: params.userId,
      durationMs: Date.now() - started,
    });

    void broadcastConversationEvent(params.conversationId, "message:new", {
      messageId: serialized.id,
    });

    return serialized;
  } catch (error) {
    logError({
      requestId: params.requestId,
      operation: "sendTextMessage",
      userId: params.userId,
      errorClass: error instanceof Error ? error.name : "unknown",
      durationMs: Date.now() - started,
    });
    throw error;
  }
}

/**
 * Inserts a sticker message. Same outbox idempotency as text:
 * unique (senderId, clientGeneratedId).
 */
export async function sendStickerMessage(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  stickerId: string;
  clientGeneratedId: string;
  replyToMessageId?: string;
}): Promise<ChatMessage> {
  const started = Date.now();
  const existing = await getMessageByClientGeneratedId(
    params.userId,
    params.clientGeneratedId,
    params.userId,
  );
  if (existing) {
    logInfo({
      requestId: params.requestId,
      operation: "sendStickerMessage.idempotent",
      userId: params.userId,
      durationMs: Date.now() - started,
    });
    return existing;
  }

  if (params.replyToMessageId) {
    await assertReplyTarget({
      conversationId: params.conversationId,
      replyToMessageId: params.replyToMessageId,
    });
  }

  const { getSendableSticker, StickerNotFoundError, StickerValidationError } =
    await import("@/lib/stickers/service");
  try {
    await getSendableSticker({
      userId: params.userId,
      conversationId: params.conversationId,
      stickerId: params.stickerId,
    });
  } catch (error) {
    if (error instanceof StickerNotFoundError || error instanceof StickerValidationError) {
      throw new ChatValidationError(error.message);
    }
    throw error;
  }

  const partnerId = await getConversationPartnerId(params.conversationId, params.userId);
  const db = getDb();

  try {
    const inserted = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(messages)
        .values({
          conversationId: params.conversationId,
          senderId: params.userId,
          clientGeneratedId: params.clientGeneratedId,
          type: "sticker",
          textContent: null,
          stickerId: params.stickerId,
          replyToMessageId: params.replyToMessageId,
          metadata: {},
        })
        .onConflictDoNothing({
          target: [messages.senderId, messages.clientGeneratedId],
        })
        .returning();

      const message =
        row ??
        (
          await tx
            .select()
            .from(messages)
            .where(
              and(
                eq(messages.senderId, params.userId),
                eq(messages.clientGeneratedId, params.clientGeneratedId),
              ),
            )
            .limit(1)
        )[0];

      if (!message) {
        throw new Error("insert_failed");
      }

      if (partnerId && row) {
        await tx
          .insert(messageReceipts)
          .values({
            messageId: message.id,
            userId: partnerId,
          })
          .onConflictDoNothing({
            target: [messageReceipts.messageId, messageReceipts.userId],
          });
      }

      return message;
    });

    const serialized =
      (await getMessageById(params.conversationId, params.userId, inserted.id)) ??
      (await getMessageByClientGeneratedId(
        params.userId,
        params.clientGeneratedId,
        params.userId,
      ))!;

    logInfo({
      requestId: params.requestId,
      operation: "sendStickerMessage",
      userId: params.userId,
      durationMs: Date.now() - started,
    });

    void broadcastConversationEvent(params.conversationId, "message:new", {
      messageId: serialized.id,
    });

    return serialized;
  } catch (error) {
    logError({
      requestId: params.requestId,
      operation: "sendStickerMessage",
      userId: params.userId,
      errorClass: error instanceof Error ? error.name : "unknown",
      durationMs: Date.now() - started,
    });
    throw error;
  }
}

/**
 * Inserts a doodle message plus its vector row in one transaction.
 * Same outbox idempotency as text: unique (senderId, clientGeneratedId).
 */
export async function sendDoodleMessage(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  document: import("@/lib/doodles/document").DoodleDocument;
  clientGeneratedId: string;
  replyToMessageId?: string;
}): Promise<ChatMessage> {
  const started = Date.now();
  const existing = await getMessageByClientGeneratedId(
    params.userId,
    params.clientGeneratedId,
    params.userId,
  );
  if (existing) {
    logInfo({
      requestId: params.requestId,
      operation: "sendDoodleMessage.idempotent",
      userId: params.userId,
      durationMs: Date.now() - started,
    });
    return existing;
  }

  if (params.replyToMessageId) {
    await assertReplyTarget({
      conversationId: params.conversationId,
      replyToMessageId: params.replyToMessageId,
    });
  }

  const { createDoodleForMessage } = await import("@/lib/doodles/service");
  const { DoodleValidationError, parseDoodleDocument } = await import("@/lib/doodles/validation");
  let document;
  try {
    document = parseDoodleDocument(params.document);
  } catch (error) {
    if (error instanceof DoodleValidationError) {
      throw new ChatValidationError(error.message);
    }
    throw error;
  }

  const partnerId = await getConversationPartnerId(params.conversationId, params.userId);
  const db = getDb();

  try {
    const inserted = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(messages)
        .values({
          conversationId: params.conversationId,
          senderId: params.userId,
          clientGeneratedId: params.clientGeneratedId,
          type: "doodle",
          textContent: null,
          replyToMessageId: params.replyToMessageId,
          metadata: {},
        })
        .onConflictDoNothing({
          target: [messages.senderId, messages.clientGeneratedId],
        })
        .returning();

      const message =
        row ??
        (
          await tx
            .select()
            .from(messages)
            .where(
              and(
                eq(messages.senderId, params.userId),
                eq(messages.clientGeneratedId, params.clientGeneratedId),
              ),
            )
            .limit(1)
        )[0];

      if (!message) {
        throw new Error("insert_failed");
      }

      if (row) {
        await createDoodleForMessage({
          tx,
          creatorId: params.userId,
          messageId: message.id,
          document,
        });
      }

      if (partnerId && row) {
        await tx
          .insert(messageReceipts)
          .values({
            messageId: message.id,
            userId: partnerId,
          })
          .onConflictDoNothing({
            target: [messageReceipts.messageId, messageReceipts.userId],
          });
      }

      return message;
    });

    const serialized =
      (await getMessageById(params.conversationId, params.userId, inserted.id)) ??
      (await getMessageByClientGeneratedId(
        params.userId,
        params.clientGeneratedId,
        params.userId,
      ))!;

    logInfo({
      requestId: params.requestId,
      operation: "sendDoodleMessage",
      userId: params.userId,
      durationMs: Date.now() - started,
    });

    void broadcastConversationEvent(params.conversationId, "message:new", {
      messageId: serialized.id,
    });

    return serialized;
  } catch (error) {
    logError({
      requestId: params.requestId,
      operation: "sendDoodleMessage",
      userId: params.userId,
      errorClass: error instanceof Error ? error.name : "unknown",
      durationMs: Date.now() - started,
    });
    if (error instanceof DoodleValidationError) {
      throw new ChatValidationError(error.message);
    }
    throw error;
  }
}
