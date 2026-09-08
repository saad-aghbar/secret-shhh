import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { bootstrapUserBySlot } from "@/lib/auth/bootstrap";
import {
  deleteMessage,
  editMessage,
  InteractionError,
  setMessageReaction,
} from "@/lib/chat/interactions";
import { sendTextMessage } from "@/lib/chat/send";
import { getDb } from "@/lib/db";
import { messageReceipts, messages, reactions } from "@/lib/db/schema";

const canRun = Boolean(process.env.DATABASE_URL);

describe.skipIf(!canRun)("phase 8 interaction authorization", () => {
  const createdIds: string[] = [];

  afterAll(async () => {
    if (createdIds.length === 0) return;
    const db = getDb();
    for (const id of createdIds) {
      await db.delete(reactions).where(eq(reactions.messageId, id));
      await db.delete(messageReceipts).where(eq(messageReceipts.messageId, id));
      await db.delete(messages).where(eq(messages.id, id));
    }
  });

  it("refuses partner edit and delete", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const tala = await bootstrapUserBySlot({ slot: "user_2", displayName: "Tala" });
    const message = await sendTextMessage({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      text: "mine only",
      clientGeneratedId: randomUUID(),
    });
    createdIds.push(message.id);

    await expect(
      editMessage({
        requestId: randomUUID(),
        userId: tala.user.id,
        conversationId: tala.conversationId,
        messageId: message.id,
        text: "stolen",
      }),
    ).rejects.toMatchObject({ status: 403 });

    await expect(
      deleteMessage({
        requestId: randomUUID(),
        userId: tala.user.id,
        conversationId: tala.conversationId,
        messageId: message.id,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("refuses reactions on a tombstone", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const message = await sendTextMessage({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      text: "do not react",
      clientGeneratedId: randomUUID(),
    });
    createdIds.push(message.id);
    await deleteMessage({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      messageId: message.id,
    });
    await expect(
      setMessageReaction({
        requestId: randomUUID(),
        userId: saad.user.id,
        conversationId: saad.conversationId,
        messageId: message.id,
        emoji: "❤️",
      }),
    ).rejects.toBeInstanceOf(InteractionError);
  });

  it("refuses a foreign-looking reply id that is not in this conversation", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    await expect(
      sendTextMessage({
        requestId: randomUUID(),
        userId: saad.user.id,
        conversationId: saad.conversationId,
        text: "nope",
        clientGeneratedId: randomUUID(),
        replyToMessageId: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(InteractionError);
  });
});
