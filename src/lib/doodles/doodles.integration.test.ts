import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { bootstrapUserBySlot } from "@/lib/auth/bootstrap";
import { getRecentMessages } from "@/lib/chat/queries";
import { sendDoodleMessage } from "@/lib/chat/send";
import { ChatValidationError } from "@/lib/chat/send";
import { getDb } from "@/lib/db";
import { doodles, messageReceipts, messages } from "@/lib/db/schema";
import { heartDocument } from "@/lib/doodles/fixtures";
import { searchMessages } from "@/lib/search/query";
import { searchMessagesQuerySchema } from "@/lib/search/validation";

const canRun = Boolean(process.env.DATABASE_URL);

describe.skipIf(!canRun)("phase 10 doodle integration", () => {
  const createdIds: string[] = [];

  afterAll(async () => {
    if (createdIds.length === 0) return;
    const db = getDb();
    for (const id of createdIds) {
      await db.delete(doodles).where(eq(doodles.messageId, id));
      await db.delete(messageReceipts).where(eq(messageReceipts.messageId, id));
      await db.delete(messages).where(eq(messages.id, id));
    }
  });

  it("sends, hydrates, is idempotent, and appears in doodle search", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const clientGeneratedId = randomUUID();
    const first = await sendDoodleMessage({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      document: heartDocument(),
      clientGeneratedId,
    });
    createdIds.push(first.id);
    expect(first.type).toBe("doodle");
    expect(first.doodle?.document.strokes.length).toBeGreaterThan(0);

    const again = await sendDoodleMessage({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      document: heartDocument("#4a756c"),
      clientGeneratedId,
    });
    expect(again.id).toBe(first.id);

    const page = await getRecentMessages(saad.conversationId, saad.user.id, 20);
    expect(page.messages.some((message) => message.id === first.id && message.type === "doodle")).toBe(
      true,
    );

    const search = await searchMessages({
      requestId: randomUUID(),
      conversationId: saad.conversationId,
      viewerId: saad.user.id,
      query: searchMessagesQuerySchema.parse({ type: "doodles", tz: "UTC" }),
    });
    expect(search.results.some((row) => row.id === first.id && row.type === "doodle")).toBe(true);
  });

  it("rejects malformed and oversized vectors", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    await expect(
      sendDoodleMessage({
        requestId: randomUUID(),
        userId: saad.user.id,
        conversationId: saad.conversationId,
        document: { version: 99, aspectRatio: 0.8, backgroundMode: "paper", strokes: [] } as never,
        clientGeneratedId: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(ChatValidationError);

    await expect(
      sendDoodleMessage({
        requestId: randomUUID(),
        userId: saad.user.id,
        conversationId: saad.conversationId,
        document: {
          version: 1,
          aspectRatio: 0.8,
          backgroundMode: "paper",
          strokes: [
            {
              id: "bad",
              tool: "pen",
              color: "url(javascript:alert(1))",
              width: 0.02,
              opacity: 1,
              points: [0.1, 0.1, 0.5],
            },
          ],
        } as never,
        clientGeneratedId: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(ChatValidationError);
  });
});
