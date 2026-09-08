import { and, eq } from "drizzle-orm";

import { InteractionError } from "@/lib/chat/interaction-error";
import { getMessageById } from "@/lib/chat/queries";
import type { ChatMessage } from "@/lib/chat/types";
import { getDb } from "@/lib/db";
import { messages, reactions } from "@/lib/db/schema";
import { parseReactionEmoji } from "@/lib/emoji";
import { logError, logInfo } from "@/lib/logger";
import { broadcastConversationEvent } from "@/lib/realtime/broadcast";

export { InteractionError };

const EDITABLE_TYPES = new Set(["text", "image", "video", "music"]);

async function loadOwnedMessage(params: {
  conversationId: string;
  messageId: string;
}) {
  const db = getDb();
  const row = (
    await db
      .select()
      .from(messages)
      .where(and(eq(messages.id, params.messageId), eq(messages.conversationId, params.conversationId)))
      .limit(1)
  )[0];
  if (!row) {
    throw new InteractionError("NOT_FOUND", "Message not found.", 404);
  }
  return row;
}

async function hydrate(conversationId: string, viewerId: string, messageId: string): Promise<ChatMessage> {
  const message = await getMessageById(conversationId, viewerId, messageId);
  if (!message) {
    throw new InteractionError("NOT_FOUND", "Message not found.", 404);
  }
  return message;
}

export async function editMessage(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  messageId: string;
  text: string;
}): Promise<ChatMessage> {
  const started = Date.now();
  try {
    const row = await loadOwnedMessage(params);
    if (row.senderId !== params.userId) {
      throw new InteractionError("FORBIDDEN", "You can only edit your own messages.", 403);
    }
    if (row.deletedAt) {
      throw new InteractionError("VALIDATION_ERROR", "That message was deleted.", 400);
    }
    if (!EDITABLE_TYPES.has(row.type)) {
      throw new InteractionError("VALIDATION_ERROR", "This message can’t be edited.", 400);
    }

    const now = new Date();
    const db = getDb();
    await db
      .update(messages)
      .set({ textContent: params.text, editedAt: now })
      .where(eq(messages.id, row.id));

    const serialized = await hydrate(params.conversationId, params.userId, row.id);
    void broadcastConversationEvent(params.conversationId, "message:edited", {
      messageId: row.id,
    });
    logInfo({
      requestId: params.requestId,
      operation: "editMessage",
      userId: params.userId,
      durationMs: Date.now() - started,
    });
    return serialized;
  } catch (error) {
    if (!(error instanceof InteractionError)) {
      logError({
        requestId: params.requestId,
        operation: "editMessage",
        userId: params.userId,
        errorClass: error instanceof Error ? error.name : "unknown",
        durationMs: Date.now() - started,
      });
    }
    throw error;
  }
}

export async function deleteMessage(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  messageId: string;
}): Promise<ChatMessage> {
  const started = Date.now();
  try {
    const row = await loadOwnedMessage(params);
    if (row.senderId !== params.userId) {
      throw new InteractionError("FORBIDDEN", "You can only delete your own messages.", 403);
    }

    if (!row.deletedAt) {
      const now = new Date();
      const db = getDb();
      await db.transaction(async (tx) => {
        await tx
          .update(messages)
          .set({
            deletedAt: now,
            deletedForEveryone: true,
            textContent: null,
            editedAt: null,
          })
          .where(eq(messages.id, row.id));
        await tx.delete(reactions).where(eq(reactions.messageId, row.id));
      });
      void broadcastConversationEvent(params.conversationId, "message:deleted", {
        messageId: row.id,
      });
    }

    const serialized = await hydrate(params.conversationId, params.userId, row.id);
    logInfo({
      requestId: params.requestId,
      operation: "deleteMessage",
      userId: params.userId,
      durationMs: Date.now() - started,
      extra: { idempotent: Boolean(row.deletedAt) },
    });
    return serialized;
  } catch (error) {
    if (!(error instanceof InteractionError)) {
      logError({
        requestId: params.requestId,
        operation: "deleteMessage",
        userId: params.userId,
        errorClass: error instanceof Error ? error.name : "unknown",
        durationMs: Date.now() - started,
      });
    }
    throw error;
  }
}

export async function setMessageReaction(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  messageId: string;
  emoji: string;
}): Promise<ChatMessage> {
  const started = Date.now();
  const emoji = parseReactionEmoji(params.emoji);
  if (!emoji) {
    throw new InteractionError("VALIDATION_ERROR", "That isn’t a valid reaction.", 400);
  }

  try {
    const row = await loadOwnedMessage(params);
    if (row.deletedAt) {
      throw new InteractionError("VALIDATION_ERROR", "That message was deleted.", 400);
    }

    const now = new Date();
    const db = getDb();
    await db
      .insert(reactions)
      .values({
        messageId: row.id,
        userId: params.userId,
        emoji,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [reactions.messageId, reactions.userId],
        set: { emoji, updatedAt: now },
      });

    const serialized = await hydrate(params.conversationId, params.userId, row.id);
    void broadcastConversationEvent(params.conversationId, "reaction:changed", {
      messageId: row.id,
    });
    logInfo({
      requestId: params.requestId,
      operation: "setMessageReaction",
      userId: params.userId,
      durationMs: Date.now() - started,
    });
    return serialized;
  } catch (error) {
    if (!(error instanceof InteractionError)) {
      logError({
        requestId: params.requestId,
        operation: "setMessageReaction",
        userId: params.userId,
        errorClass: error instanceof Error ? error.name : "unknown",
        durationMs: Date.now() - started,
      });
    }
    throw error;
  }
}

export async function clearMessageReaction(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  messageId: string;
}): Promise<ChatMessage> {
  const started = Date.now();
  try {
    const row = await loadOwnedMessage(params);
    const db = getDb();
    await db
      .delete(reactions)
      .where(and(eq(reactions.messageId, row.id), eq(reactions.userId, params.userId)));

    const serialized = await hydrate(params.conversationId, params.userId, row.id);
    void broadcastConversationEvent(params.conversationId, "reaction:changed", {
      messageId: row.id,
    });
    logInfo({
      requestId: params.requestId,
      operation: "clearMessageReaction",
      userId: params.userId,
      durationMs: Date.now() - started,
    });
    return serialized;
  } catch (error) {
    if (!(error instanceof InteractionError)) {
      logError({
        requestId: params.requestId,
        operation: "clearMessageReaction",
        userId: params.userId,
        errorClass: error instanceof Error ? error.name : "unknown",
        durationMs: Date.now() - started,
      });
    }
    throw error;
  }
}
