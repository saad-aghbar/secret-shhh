import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { bootstrapUserBySlot } from "@/lib/auth/bootstrap";
import { getMessagesAround } from "@/lib/chat/queries";
import { sendTextMessage } from "@/lib/chat/send";
import { getDb } from "@/lib/db";
import { messageReceipts, messages } from "@/lib/db/schema";
import { getAdjacentActiveDay, getFirstMessageOnDay, getMonthActivity } from "@/lib/history/queries";
import { searchMessages } from "@/lib/search/query";
import { searchMessagesQuerySchema } from "@/lib/search/validation";

const canRun = Boolean(process.env.DATABASE_URL);

describe.skipIf(!canRun)("phase 3 search + history integration", () => {
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

  async function seedPair() {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const tala = await bootstrapUserBySlot({ slot: "user_2", displayName: "Tala" });
    return { saad, tala };
  }

  async function send(
    userId: string,
    conversationId: string,
    text: string,
    createdAt?: Date,
  ) {
    const message = await sendTextMessage({
      requestId: randomUUID(),
      userId,
      conversationId,
      text,
      clientGeneratedId: randomUUID(),
    });
    createdIds.push(message.id);
    if (createdAt) {
      const db = getDb();
      await db.update(messages).set({ createdAt }).where(eq(messages.id, message.id));
      // Trigger refresh of search_vector already ran on insert; text unchanged.
    }
    return message;
  }

  it("finds English, Arabic, mixed, and URL text", async () => {
    const { saad } = await seedPair();
    const en = await send(saad.user.id, saad.conversationId, `phase3-en-${randomUUID().slice(0, 8)} love`);
    const ar = await send(saad.user.id, saad.conversationId, `phase3-ar بحبك ${randomUUID().slice(0, 6)}`);
    const mix = await send(
      saad.user.id,
      saad.conversationId,
      `phase3-mix بحبك so much ${randomUUID().slice(0, 6)}`,
    );
    const url = await send(
      saad.user.id,
      saad.conversationId,
      `phase3-url https://example.com/${randomUUID().slice(0, 6)}`,
    );

    const love = await searchMessages({
      requestId: randomUUID(),
      conversationId: saad.conversationId,
      viewerId: saad.user.id,
      query: searchMessagesQuerySchema.parse({ q: "love", tz: "UTC" }),
    });
    expect(love.results.some((r) => r.id === en.id)).toBe(true);

    const arabic = await searchMessages({
      requestId: randomUUID(),
      conversationId: saad.conversationId,
      viewerId: saad.user.id,
      query: searchMessagesQuerySchema.parse({ q: "بحبك", tz: "UTC" }),
    });
    expect(arabic.results.some((r) => r.id === ar.id || r.id === mix.id)).toBe(true);

    const mixed = await searchMessages({
      requestId: randomUUID(),
      conversationId: saad.conversationId,
      viewerId: saad.user.id,
      query: searchMessagesQuerySchema.parse({ q: "بحبك so much", tz: "UTC" }),
    });
    expect(mixed.results.some((r) => r.id === mix.id)).toBe(true);

    const links = await searchMessages({
      requestId: randomUUID(),
      conversationId: saad.conversationId,
      viewerId: saad.user.id,
      query: searchMessagesQuerySchema.parse({ q: "", type: "links", tz: "UTC" }),
    });
    expect(links.results.some((r) => r.id === url.id)).toBe(true);
  });

  it("filters by sender and supports short-query fallback", async () => {
    const { saad, tala } = await seedPair();
    const mine = await send(saad.user.id, saad.conversationId, `phase3-me-${randomUUID().slice(0, 8)}`);
    const theirs = await send(
      tala.user.id,
      saad.conversationId,
      `phase3-partner-${randomUUID().slice(0, 8)}`,
    );

    const me = await searchMessages({
      requestId: randomUUID(),
      conversationId: saad.conversationId,
      viewerId: saad.user.id,
      query: searchMessagesQuerySchema.parse({ q: "phase3-me", sender: "me", tz: "UTC" }),
    });
    expect(me.results.some((r) => r.id === mine.id)).toBe(true);
    expect(me.results.some((r) => r.id === theirs.id)).toBe(false);

    const partner = await searchMessages({
      requestId: randomUUID(),
      conversationId: saad.conversationId,
      viewerId: saad.user.id,
      query: searchMessagesQuerySchema.parse({
        q: "phase3-partner",
        sender: "partner",
        tz: "UTC",
      }),
    });
    expect(partner.results.some((r) => r.id === theirs.id)).toBe(true);

    const short = await searchMessages({
      requestId: randomUUID(),
      conversationId: saad.conversationId,
      viewerId: saad.user.id,
      query: searchMessagesQuerySchema.parse({ q: "p3", tz: "UTC" }),
    });
    // Short query uses trgm; may or may not match depending on content — must not throw.
    expect(Array.isArray(short.results)).toBe(true);
  });

  it("returns context around a target without duplicating it", async () => {
    const { saad } = await seedPair();
    const ids: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const msg = await send(saad.user.id, saad.conversationId, `phase3-ctx-${i}-${randomUUID().slice(0, 6)}`);
      ids.push(msg.id);
    }
    const targetId = ids[2]!;
    const context = await getMessagesAround(saad.conversationId, saad.user.id, targetId, {
      before: 10,
      after: 10,
    });
    expect(context.target?.id).toBe(targetId);
    expect(context.before.every((m) => m.id !== targetId)).toBe(true);
    expect(context.after.every((m) => m.id !== targetId)).toBe(true);
    expect(context.before.some((m) => m.id === ids[0])).toBe(true);
    expect(context.after.some((m) => m.id === ids[4])).toBe(true);

    const missing = await getMessagesAround(saad.conversationId, saad.user.id, randomUUID());
    expect(missing.target).toBeNull();
  });

  it("month activity and adjacent days use timezone bounds", async () => {
    const { saad } = await seedPair();
    const stamp = new Date("2024-06-15T12:00:00.000Z");
    const msg = await send(
      saad.user.id,
      saad.conversationId,
      `phase3-day-${randomUUID().slice(0, 8)}`,
      stamp,
    );

    const month = await getMonthActivity({
      conversationId: saad.conversationId,
      year: 2024,
      month: 6,
      timeZone: "UTC",
    });
    expect(month.some((d) => d.date === "2024-06-15" && d.count >= 1)).toBe(true);

    const first = await getFirstMessageOnDay({
      conversationId: saad.conversationId,
      viewerId: saad.user.id,
      date: "2024-06-15",
      timeZone: "UTC",
    });
    expect(first?.id).toBe(msg.id);

    const empty = await getFirstMessageOnDay({
      conversationId: saad.conversationId,
      viewerId: saad.user.id,
      date: "1999-01-01",
      timeZone: "UTC",
    });
    expect(empty).toBeNull();

    const next = await getAdjacentActiveDay({
      conversationId: saad.conversationId,
      date: "2024-06-14",
      timeZone: "UTC",
      dir: "next",
    });
    expect(next?.date).toBe("2024-06-15");
  });

  it("rejects invalid search params", () => {
    expect(searchMessagesQuerySchema.safeParse({ q: "x".repeat(201) }).success).toBe(false);
    expect(searchMessagesQuerySchema.safeParse({ sender: "evil" }).success).toBe(false);
    expect(searchMessagesQuerySchema.safeParse({ from: "2026-02-31" }).success).toBe(false);
  });
});
