import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { bootstrapUserBySlot } from "@/lib/auth/bootstrap";
import {
  clearMessageReaction,
  deleteMessage,
  editMessage,
  InteractionError,
  setMessageReaction,
} from "@/lib/chat/interactions";
import { getMessageById, getRecentMessages } from "@/lib/chat/queries";
import { sendTextMessage } from "@/lib/chat/send";
import { getDb } from "@/lib/db";
import { messageMedia, messageReceipts, messages, reactions } from "@/lib/db/schema";
import {
  completeMediaUpload,
  createMediaReadUrl,
  finalizePhotoMessage,
  initMediaUpload,
} from "@/lib/media/service";
import { searchMessages } from "@/lib/search/query";
import { searchMessagesQuerySchema } from "@/lib/search/validation";
import { resetStorageProviderCache } from "@/lib/storage";
import { resetTestStorage, writeTestObject } from "@/lib/storage/test-provider";

const canRun = Boolean(process.env.DATABASE_URL);

describe.skipIf(!canRun)("phase 8 interactions", () => {
  const createdIds: string[] = [];

  afterAll(async () => {
    if (createdIds.length === 0) return;
    const db = getDb();
    for (const id of createdIds) {
      await db.delete(reactions).where(eq(reactions.messageId, id));
      await db.delete(messageMedia).where(eq(messageMedia.messageId, id));
      await db.delete(messageReceipts).where(eq(messageReceipts.messageId, id));
      await db.delete(messages).where(eq(messages.id, id));
    }
  });

  async function send(userId: string, conversationId: string, text: string, replyToMessageId?: string) {
    const message = await sendTextMessage({
      requestId: randomUUID(),
      userId,
      conversationId,
      text,
      clientGeneratedId: randomUUID(),
      replyToMessageId,
    });
    createdIds.push(message.id);
    return message;
  }

  it("replies in the same conversation with a shallow preview", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const tala = await bootstrapUserBySlot({ slot: "user_2", displayName: "Tala" });
    const original = await send(tala.user.id, tala.conversationId, "you looked so cute here");
    const reply = await send(saad.user.id, saad.conversationId, "always do", original.id);

    expect(reply.replyTo?.id).toBe(original.id);
    expect(reply.replyTo?.deleted).toBe(false);
    expect(reply.replyTo?.textSnippet).toContain("cute");
    expect(reply.replyTo && "replyTo" in reply.replyTo).toBe(false);
  });

  it("replies to photo, video, and voice targets", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const db = getDb();
    const kinds = [
      { type: "image" as const, text: "cute still" },
      { type: "video" as const, text: "watch this" },
      { type: "audio" as const, text: null },
    ];
    for (const kind of kinds) {
      const [row] = await db
        .insert(messages)
        .values({
          conversationId: saad.conversationId,
          senderId: saad.user.id,
          clientGeneratedId: randomUUID(),
          type: kind.type,
          textContent: kind.text,
          metadata: {},
        })
        .returning();
      createdIds.push(row.id);
      const reply = await send(saad.user.id, saad.conversationId, `reply to ${kind.type}`, row.id);
      expect(reply.replyTo?.id).toBe(row.id);
      expect(reply.replyTo?.type).toBe(kind.type);
      expect(reply.replyTo?.deleted).toBe(false);
    }
  });

  it("refuses a reply to a deleted message", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const original = await send(saad.user.id, saad.conversationId, "gone soon");
    await deleteMessage({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      messageId: original.id,
    });
    await expect(
      send(saad.user.id, saad.conversationId, "nope", original.id),
    ).rejects.toBeInstanceOf(InteractionError);
  });

  it("keeps an existing reply preview after the original is deleted", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const tala = await bootstrapUserBySlot({ slot: "user_2", displayName: "Tala" });
    const original = await send(tala.user.id, tala.conversationId, "keep this reference");
    const reply = await send(saad.user.id, saad.conversationId, "noted", original.id);
    await deleteMessage({
      requestId: randomUUID(),
      userId: tala.user.id,
      conversationId: tala.conversationId,
      messageId: original.id,
    });
    const again = await getMessageById(saad.conversationId, saad.user.id, reply.id);
    expect(again?.replyTo?.deleted).toBe(true);
    expect(again?.replyTo?.textSnippet).toBeNull();
  });

  it("adds, replaces, and removes one reaction per person", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const tala = await bootstrapUserBySlot({ slot: "user_2", displayName: "Tala" });
    const message = await send(tala.user.id, tala.conversationId, "react to me");

    const heart = await setMessageReaction({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      messageId: message.id,
      emoji: "❤️",
    });
    expect(heart.reactions).toHaveLength(1);

    const joy = await setMessageReaction({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      messageId: message.id,
      emoji: "😂",
    });
    expect(joy.reactions).toHaveLength(1);
    expect(joy.reactions?.[0]?.emoji).toBe("😂");

    await setMessageReaction({
      requestId: randomUUID(),
      userId: tala.user.id,
      conversationId: tala.conversationId,
      messageId: message.id,
      emoji: "😂",
    });
    const both = await getMessageById(saad.conversationId, saad.user.id, message.id);
    expect(both?.reactions).toHaveLength(2);

    const cleared = await clearMessageReaction({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      messageId: message.id,
    });
    expect(cleared.reactions).toHaveLength(1);
  });

  it("edits own text and updates search", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const unique = randomUUID().slice(0, 8);
    const message = await send(saad.user.id, saad.conversationId, `helo-${unique}`);
    const edited = await editMessage({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      messageId: message.id,
      text: `hello-${unique}`,
    });
    expect(edited.textContent).toBe(`hello-${unique}`);
    expect(edited.editedAt).toBeTruthy();

    const oldHits = await searchMessages({
      requestId: randomUUID(),
      conversationId: saad.conversationId,
      viewerId: saad.user.id,
      query: searchMessagesQuerySchema.parse({ q: `helo-${unique}`, tz: "UTC" }),
    });
    const newHits = await searchMessages({
      requestId: randomUUID(),
      conversationId: saad.conversationId,
      viewerId: saad.user.id,
      query: searchMessagesQuerySchema.parse({ q: `hello-${unique}`, tz: "UTC" }),
    });
    expect(oldHits.results.some((item) => item.id === message.id)).toBe(false);
    expect(newHits.results.some((item) => item.id === message.id)).toBe(true);
  });

  it("tombstones a delete idempotently and hides it from search", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const unique = `delete-me-${randomUUID().slice(0, 8)}`;
    const message = await send(saad.user.id, saad.conversationId, unique);
    const first = await deleteMessage({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      messageId: message.id,
    });
    const second = await deleteMessage({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      messageId: message.id,
    });
    expect(first.deletedAt).toBeTruthy();
    expect(second.deletedAt).toBe(first.deletedAt);
    expect(first.textContent).toBe("");

    const recent = await getRecentMessages(saad.conversationId, saad.user.id, 20);
    expect(recent.messages.some((item) => item.id === message.id && item.deletedAt)).toBe(true);

    const hits = await searchMessages({
      requestId: randomUUID(),
      conversationId: saad.conversationId,
      viewerId: saad.user.id,
      query: searchMessagesQuerySchema.parse({ q: unique, tz: "UTC" }),
    });
    expect(hits.results.some((item) => item.id === message.id)).toBe(false);
  });

  it("keeps media readable after a chat delete", async () => {
    const previousProvider = process.env.STORAGE_PROVIDER;
    process.env.STORAGE_PROVIDER = "test";
    resetStorageProviderCache();
    resetTestStorage();

    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const clientGeneratedId = randomUUID();
    const clientAssetId = randomUUID();
    const mediaFolderId = randomUUID();
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    async function uploadVariant(variant: "original" | "preview" | "thumbnail") {
      const init = await initMediaUpload({
        requestId: randomUUID(),
        userId: saad.user.id,
        conversationId: saad.conversationId,
        clientGeneratedId,
        clientAssetId,
        variant,
        filename: "keep.jpg",
        mimeType: "image/jpeg",
        size: jpeg.byteLength,
        width: 8,
        height: 8,
        mediaFolderId,
      });
      writeTestObject(init.storageKey, jpeg, "image/jpeg");
      await completeMediaUpload({
        requestId: randomUUID(),
        userId: saad.user.id,
        uploadId: init.uploadId,
      });
      return init.uploadId;
    }

    const originalUploadId = await uploadVariant("original");
    const previewUploadId = await uploadVariant("preview");
    const thumbnailUploadId = await uploadVariant("thumbnail");
    const photo = await finalizePhotoMessage({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      clientGeneratedId,
      caption: "library stays",
      assets: [
        {
          clientAssetId,
          sortOrder: 0,
          originalUploadId,
          previewUploadId,
          thumbnailUploadId,
          width: 8,
          height: 8,
          mimeType: "image/jpeg",
          originalFilename: "keep.jpg",
        },
      ],
    });
    createdIds.push(photo.id);
    const mediaId = photo.media?.[0]?.id;
    expect(mediaId).toBeTruthy();

    await deleteMessage({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      messageId: photo.id,
    });

    const url = await createMediaReadUrl({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      mediaId: mediaId!,
      variant: "thumb",
    });
    expect(url.url).toBeTruthy();

    process.env.STORAGE_PROVIDER = previousProvider;
    resetStorageProviderCache();
  });
});
