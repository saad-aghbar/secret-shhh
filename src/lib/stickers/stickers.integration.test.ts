import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bootstrapUserBySlot } from "@/lib/auth/bootstrap";
import { getRecentMessages } from "@/lib/chat/queries";
import { sendStickerMessage, sendTextMessage } from "@/lib/chat/send";
import { getDb } from "@/lib/db";
import {
  messageReceipts,
  messages,
  stickerFavorites,
  stickerLibrary,
  stickers,
} from "@/lib/db/schema";
import { searchMessages } from "@/lib/search/query";
import { searchMessagesQuerySchema } from "@/lib/search/validation";
import { resetStorageProviderCache } from "@/lib/storage";
import { resetTestStorage } from "@/lib/storage/test-provider";
import { TINY_GIF, TINY_PNG } from "@/lib/stickers/fixtures";
import {
  archiveSticker,
  cleanupUnreferencedStickers,
  createSticker,
  createStickerReadUrl,
  listStickers,
  saveToLibrary,
  setFavorite,
} from "@/lib/stickers/service";

const canRun = Boolean(process.env.DATABASE_URL);

describe.skipIf(!canRun)("phase 9 sticker integration", () => {
  const createdMessageIds: string[] = [];
  const createdStickerIds: string[] = [];
  const previousProvider = process.env.STORAGE_PROVIDER;

  beforeAll(() => {
    process.env.STORAGE_PROVIDER = "test";
    resetStorageProviderCache();
    resetTestStorage();
  });

  afterAll(async () => {
    process.env.STORAGE_PROVIDER = previousProvider;
    resetStorageProviderCache();
    const db = getDb();
    for (const id of createdMessageIds) {
      await db.delete(messageReceipts).where(eq(messageReceipts.messageId, id));
      await db.delete(messages).where(eq(messages.id, id));
    }
    for (const id of createdStickerIds) {
      await db.delete(stickerFavorites).where(eq(stickerFavorites.stickerId, id));
      await db.delete(stickerLibrary).where(eq(stickerLibrary.stickerId, id));
      await db
        .delete(stickers)
        .where(eq(stickers.id, id))
        .catch(() => undefined);
    }
  });

  async function makeSticker(
    userId: string,
    conversationId: string,
    name?: string,
    animated = false,
  ) {
    const sticker = await createSticker({
      requestId: randomUUID(),
      userId,
      conversationId,
      bytes: animated ? TINY_GIF : TINY_PNG,
      declaredMime: animated ? "image/gif" : "image/png",
      meta: {
        id: randomUUID(),
        name: name ?? null,
        animated,
        width: 512,
        height: 512,
      },
    });
    createdStickerIds.push(sticker.id);
    return sticker;
  }

  it("creates, lists, favorites, sends, and hydrates a sticker message", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const tala = await bootstrapUserBySlot({ slot: "user_2", displayName: "Tala" });
    const sticker = await makeSticker(saad.user.id, saad.conversationId, "بحبك");

    const again = await createSticker({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      bytes: TINY_PNG,
      declaredMime: "image/png",
      meta: {
        id: sticker.id,
        name: "ignored",
        animated: false,
        width: 512,
        height: 512,
      },
    });
    expect(again.id).toBe(sticker.id);
    expect(again.name).toBe("بحبك");

    await setFavorite({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      stickerId: sticker.id,
      favorite: true,
    });

    const library = await listStickers({
      userId: saad.user.id,
      conversationId: saad.conversationId,
    });
    expect(library.partnerName).toBe("Tala");
    expect(library.mine.some((item) => item.id === sticker.id)).toBe(true);
    expect(library.favorites.some((item) => item.id === sticker.id && item.favorited)).toBe(true);

    const message = await sendStickerMessage({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      stickerId: sticker.id,
      clientGeneratedId: randomUUID(),
    });
    createdMessageIds.push(message.id);
    expect(message.type).toBe("sticker");
    expect(message.sticker?.name).toBe("بحبك");

    const resent = await sendStickerMessage({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      stickerId: sticker.id,
      clientGeneratedId: message.clientGeneratedId,
    });
    expect(resent.id).toBe(message.id);

    const page = await getRecentMessages(saad.conversationId, tala.user.id, 20);
    const incoming = page.messages.find((row) => row.id === message.id);
    expect(incoming?.type).toBe("sticker");
    expect(incoming?.sticker?.id).toBe(sticker.id);

    const saved = await saveToLibrary({
      requestId: randomUUID(),
      userId: tala.user.id,
      conversationId: tala.conversationId,
      stickerId: sticker.id,
    });
    expect(saved.saved).toBe(true);
    const savedAgain = await saveToLibrary({
      requestId: randomUUID(),
      userId: tala.user.id,
      conversationId: tala.conversationId,
      stickerId: sticker.id,
    });
    expect(savedAgain.saved).toBe(true);

    const url = await createStickerReadUrl({
      requestId: randomUUID(),
      userId: tala.user.id,
      conversationId: tala.conversationId,
      stickerId: sticker.id,
    });
    expect(url.url).toContain("http");
  });

  it("archives from the library, keeps historic chat art readable, and blocks resend", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const tala = await bootstrapUserBySlot({ slot: "user_2", displayName: "Tala" });
    const sticker = await makeSticker(saad.user.id, saad.conversationId, "gone");
    const message = await sendStickerMessage({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      stickerId: sticker.id,
      clientGeneratedId: randomUUID(),
    });
    createdMessageIds.push(message.id);

    await archiveSticker({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      stickerId: sticker.id,
    });

    const page = await getRecentMessages(saad.conversationId, tala.user.id, 20);
    const historic = page.messages.find((row) => row.id === message.id);
    expect(historic?.id).toBe(message.id);
    expect(historic?.sticker?.id).toBe(sticker.id);

    const url = await createStickerReadUrl({
      requestId: randomUUID(),
      userId: tala.user.id,
      conversationId: tala.conversationId,
      stickerId: sticker.id,
    });
    expect(url.url).toContain("http");

    const library = await listStickers({
      userId: saad.user.id,
      conversationId: saad.conversationId,
    });
    expect(library.mine.some((item) => item.id === sticker.id)).toBe(false);
    expect(library.recent.some((item) => item.id === sticker.id)).toBe(false);
    expect(library.favorites.some((item) => item.id === sticker.id)).toBe(false);

    await expect(
      sendStickerMessage({
        requestId: randomUUID(),
        userId: saad.user.id,
        conversationId: saad.conversationId,
        stickerId: sticker.id,
        clientGeneratedId: randomUUID(),
      }),
    ).rejects.toThrow(/unavailable|find/i);

    const cleaned = await cleanupUnreferencedStickers();
    expect(cleaned.deleted).toBe(0);
  });

  it("hard-deletes an archived sticker only when no message references it", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const sticker = await makeSticker(saad.user.id, saad.conversationId, "orphan");
    await archiveSticker({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      stickerId: sticker.id,
    });
    const cleaned = await cleanupUnreferencedStickers();
    expect(cleaned.deleted).toBeGreaterThanOrEqual(1);
    const db = getDb();
    const row = (await db.select().from(stickers).where(eq(stickers.id, sticker.id)))[0];
    expect(row).toBeUndefined();
  });

  it("filters search by sticker type without requiring a name match", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const sticker = await makeSticker(saad.user.id, saad.conversationId, "search-me");
    const message = await sendStickerMessage({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      stickerId: sticker.id,
      clientGeneratedId: randomUUID(),
    });
    createdMessageIds.push(message.id);
    await sendTextMessage({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      text: `phase9-text-${randomUUID().slice(0, 6)}`,
      clientGeneratedId: randomUUID(),
    }).then((row) => createdMessageIds.push(row.id));

    const page = await searchMessages({
      requestId: randomUUID(),
      conversationId: saad.conversationId,
      viewerId: saad.user.id,
      query: searchMessagesQuerySchema.parse({ type: "stickers", tz: "UTC" }),
    });
    expect(page.results.some((row) => row.id === message.id && row.type === "sticker")).toBe(true);
    expect(page.results.every((row) => row.type === "sticker")).toBe(true);
  });
});
