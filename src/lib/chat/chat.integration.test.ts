import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { bootstrapUserBySlot } from "@/lib/auth/bootstrap";
import { getMessagesBefore, getRecentMessages } from "@/lib/chat/queries";
import {
  getOutgoingReceiptStates,
  markMessagesDelivered,
  markMessagesRead,
} from "@/lib/chat/receipts";
import { sendTextMessage } from "@/lib/chat/send";
import { MESSAGE_FIXTURES } from "@/lib/chat/fixtures";
import { getDb } from "@/lib/db";
import { messageReceipts, messages } from "@/lib/db/schema";

const canRun = Boolean(process.env.DATABASE_URL);

describe.skipIf(!canRun)("chat integration", () => {
  const createdIds: string[] = [];

  afterAll(async () => {
    if (createdIds.length === 0) {
      return;
    }
    const db = getDb();
    for (const id of createdIds) {
      await db.delete(messageReceipts).where(eq(messageReceipts.messageId, id));
      await db.delete(messages).where(eq(messages.id, id));
    }
  });

  it("derives sender server-side and ignores spoofed identity", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const tala = await bootstrapUserBySlot({ slot: "user_2", displayName: "Tala" });
    expect(saad.conversationId).toBe(tala.conversationId);

    const clientGeneratedId = randomUUID();
    const message = await sendTextMessage({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      text: MESSAGE_FIXTURES.english,
      clientGeneratedId,
    });
    createdIds.push(message.id);

    expect(message.senderId).toBe(saad.user.id);
    expect(message.senderId).not.toBe(tala.user.id);
    expect(message.textContent).toBe(MESSAGE_FIXTURES.english);
  });

  it("is idempotent on senderId + clientGeneratedId", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const clientGeneratedId = randomUUID();
    const first = await sendTextMessage({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      text: MESSAGE_FIXTURES.arabic,
      clientGeneratedId,
    });
    const second = await sendTextMessage({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      text: MESSAGE_FIXTURES.arabic,
      clientGeneratedId,
    });
    createdIds.push(first.id);
    expect(second.id).toBe(first.id);

    const db = getDb();
    const rows = await db
      .select()
      .from(messages)
      .where(
        and(eq(messages.senderId, saad.user.id), eq(messages.clientGeneratedId, clientGeneratedId)),
      );
    expect(rows).toHaveLength(1);
  });

  it("accepts mixed Unicode and paginates by cursor", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const ids: string[] = [];
    for (const text of [
      MESSAGE_FIXTURES.englishFirstMixed,
      MESSAGE_FIXTURES.arabicFirstMixed,
      MESSAGE_FIXTURES.numbers,
    ]) {
      const message = await sendTextMessage({
        requestId: randomUUID(),
        userId: saad.user.id,
        conversationId: saad.conversationId,
        text,
        clientGeneratedId: randomUUID(),
      });
      ids.push(message.id);
      createdIds.push(message.id);
    }

    const recent = await getRecentMessages(saad.conversationId, saad.user.id, 2);
    expect(recent.messages.length).toBe(2);
    expect(recent.nextBeforeCursor).toBeTruthy();

    const older = await getMessagesBefore(
      saad.conversationId,
      saad.user.id,
      recent.messages[0]!.id,
      10,
    );
    expect(older.messages.every((item) => item.createdAt <= recent.messages[0]!.createdAt)).toBe(
      true,
    );
    expect(ids.length).toBe(3);
  });

  it("batches delivered and read receipts for the receiver", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const tala = await bootstrapUserBySlot({ slot: "user_2", displayName: "Tala" });
    const message = await sendTextMessage({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      text: MESSAGE_FIXTURES.emoji,
      clientGeneratedId: randomUUID(),
    });
    createdIds.push(message.id);

    const delivered = await markMessagesDelivered({
      requestId: randomUUID(),
      userId: tala.user.id,
      conversationId: tala.conversationId,
      messageIds: [message.id],
    });
    expect(delivered.updated).toBe(1);

    const read = await markMessagesRead({
      requestId: randomUUID(),
      userId: tala.user.id,
      conversationId: tala.conversationId,
      messageIds: [message.id],
    });
    expect(read.updated).toBe(1);

    // Sender cannot mark their own outgoing as read via this path.
    const spoof = await markMessagesRead({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      messageIds: [message.id],
    });
    expect(spoof.updated).toBe(0);

    const forSender = await getOutgoingReceiptStates({
      userId: saad.user.id,
      conversationId: saad.conversationId,
      messageIds: [message.id],
    });
    expect(forSender).toHaveLength(1);
    expect(forSender[0]?.deliveredAt).toBeTruthy();
    expect(forSender[0]?.readAt).toBeTruthy();
  });
});
