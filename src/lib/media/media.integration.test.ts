import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bootstrapUserBySlot } from "@/lib/auth/bootstrap";
import { getDb } from "@/lib/db";
import { messageMedia, messages } from "@/lib/db/schema";
import { completeMediaUpload, finalizePhotoMessage, initMediaUpload } from "@/lib/media/service";
import { resetStorageProviderCache } from "@/lib/storage";
import { resetTestStorage, writeTestObject } from "@/lib/storage/test-provider";

const canRun = Boolean(process.env.DATABASE_URL);

describe.skipIf(!canRun)("phase 4 media integration", () => {
  const createdMessageIds: string[] = [];
  const previousProvider = process.env.STORAGE_PROVIDER;

  beforeAll(() => {
    process.env.STORAGE_PROVIDER = "test";
    resetStorageProviderCache();
    resetTestStorage();
  });

  afterAll(async () => {
    process.env.STORAGE_PROVIDER = previousProvider;
    resetStorageProviderCache();
    if (createdMessageIds.length === 0) return;
    const db = getDb();
    for (const id of createdMessageIds) {
      await db.delete(messageMedia).where(eq(messageMedia.messageId, id));
      await db.delete(messages).where(eq(messages.id, id));
    }
  });

  it("init → put → complete → finalize creates image message with media", async () => {
    resetTestStorage();
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const clientGeneratedId = randomUUID();
    const clientAssetId = randomUUID();
    const mediaFolderId = randomUUID();
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    async function uploadVariant(
      variant: "original" | "preview" | "thumbnail",
      mimeType: string,
      body: Uint8Array,
    ) {
      const init = await initMediaUpload({
        requestId: randomUUID(),
        userId: saad.user.id,
        conversationId: saad.conversationId,
        clientGeneratedId,
        clientAssetId,
        variant,
        filename: "fixture.jpg",
        mimeType,
        size: body.byteLength,
        width: 8,
        height: 8,
        mediaFolderId,
      });
      writeTestObject(init.storageKey, body, mimeType);
      await completeMediaUpload({
        requestId: randomUUID(),
        userId: saad.user.id,
        uploadId: init.uploadId,
      });
      return init.uploadId;
    }

    const originalUploadId = await uploadVariant("original", "image/jpeg", jpeg);
    const previewUploadId = await uploadVariant("preview", "image/webp", jpeg);
    const thumbnailUploadId = await uploadVariant("thumbnail", "image/webp", jpeg);

    const message = await finalizePhotoMessage({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      clientGeneratedId,
      caption: "هاي الصورة from today ❤️",
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
          originalFilename: "fixture.jpg",
        },
      ],
    });
    createdMessageIds.push(message.id);

    expect(message.type).toBe("image");
    expect(message.textContent).toContain("هاي");
    expect(message.media?.length).toBe(1);
    expect(message.media?.[0]?.hasThumbnail).toBe(true);

    const again = await finalizePhotoMessage({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      clientGeneratedId,
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
          originalFilename: "fixture.jpg",
        },
      ],
    });
    expect(again.id).toBe(message.id);
  });

  it("PNG original with JPEG preview/thumb uses mime-aware storage keys", async () => {
    resetTestStorage();
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const clientGeneratedId = randomUUID();
    const clientAssetId = randomUUID();
    const mediaFolderId = randomUUID();
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    async function uploadVariant(
      variant: "original" | "preview" | "thumbnail",
      mimeType: string,
      body: Uint8Array,
    ) {
      const init = await initMediaUpload({
        requestId: randomUUID(),
        userId: saad.user.id,
        conversationId: saad.conversationId,
        clientGeneratedId,
        clientAssetId,
        variant,
        filename: variant === "original" ? "screenshot.png" : "derivative.jpg",
        mimeType,
        size: body.byteLength,
        width: 800,
        height: 1200,
        mediaFolderId,
      });
      writeTestObject(init.storageKey, body, mimeType);
      await completeMediaUpload({
        requestId: randomUUID(),
        userId: saad.user.id,
        uploadId: init.uploadId,
      });
      return init;
    }

    const original = await uploadVariant("original", "image/png", png);
    const preview = await uploadVariant("preview", "image/jpeg", jpeg);
    const thumb = await uploadVariant("thumbnail", "image/jpeg", jpeg);

    expect(original.storageKey.endsWith("/original")).toBe(true);
    expect(preview.storageKey.endsWith("/preview.jpg")).toBe(true);
    expect(thumb.storageKey.endsWith("/thumb.jpg")).toBe(true);

    const message = await finalizePhotoMessage({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      clientGeneratedId,
      caption: "png screenshot path",
      assets: [
        {
          clientAssetId,
          sortOrder: 0,
          originalUploadId: original.uploadId,
          previewUploadId: preview.uploadId,
          thumbnailUploadId: thumb.uploadId,
          width: 800,
          height: 1200,
          mimeType: "image/png",
          originalFilename: "screenshot.png",
        },
      ],
    });
    createdMessageIds.push(message.id);
    expect(message.type).toBe("image");
    expect(message.media?.[0]?.mimeType).toBe("image/png");
  });

  it("rejects svg originals", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    await expect(
      initMediaUpload({
        requestId: randomUUID(),
        userId: saad.user.id,
        conversationId: saad.conversationId,
        clientGeneratedId: randomUUID(),
        clientAssetId: randomUUID(),
        variant: "original",
        filename: "x.svg",
        mimeType: "image/svg+xml",
        size: 128,
        mediaFolderId: randomUUID(),
      }),
    ).rejects.toThrow(/supported/i);
  });

  it("lists finalized shared media including every album photo", async () => {
    resetTestStorage();
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const tala = await bootstrapUserBySlot({ slot: "user_2", displayName: "Tala" });
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    async function sendAlbum(user: typeof saad, caption: string, photoCount: number) {
      const clientGeneratedId = randomUUID();
      const assets = [];
      for (let i = 0; i < photoCount; i += 1) {
        const clientAssetId = randomUUID();
        const mediaFolderId = randomUUID();
        async function uploadVariant(variant: "original" | "preview" | "thumbnail") {
          const init = await initMediaUpload({
            requestId: randomUUID(),
            userId: user.user.id,
            conversationId: user.conversationId,
            clientGeneratedId,
            clientAssetId,
            variant,
            filename: `p${i}.jpg`,
            mimeType: variant === "original" ? "image/jpeg" : "image/webp",
            size: jpeg.byteLength,
            width: 8,
            height: 8,
            mediaFolderId,
          });
          writeTestObject(
            init.storageKey,
            jpeg,
            init.storageKey.includes("original") ? "image/jpeg" : "image/webp",
          );
          await completeMediaUpload({
            requestId: randomUUID(),
            userId: user.user.id,
            uploadId: init.uploadId,
          });
          return init.uploadId;
        }
        assets.push({
          clientAssetId,
          sortOrder: i,
          originalUploadId: await uploadVariant("original"),
          previewUploadId: await uploadVariant("preview"),
          thumbnailUploadId: await uploadVariant("thumbnail"),
          width: 8,
          height: 8,
          mimeType: "image/jpeg",
          originalFilename: `p${i}.jpg`,
        });
      }
      const message = await finalizePhotoMessage({
        requestId: randomUUID(),
        userId: user.user.id,
        conversationId: user.conversationId,
        clientGeneratedId,
        caption,
        assets,
      });
      createdMessageIds.push(message.id);
      return message;
    }

    const saadAlbumCaption = `saad shared album ${randomUUID()}`;
    const talaAlbumCaption = `tala shared one ${randomUUID()}`;
    const saadAlbum = await sendAlbum(saad, saadAlbumCaption, 3);
    await sendAlbum(tala, talaAlbumCaption, 1);

    const { listSharedConversationMedia, listReadyMediaForMessage } =
      await import("@/lib/media/service");

    const page = await listSharedConversationMedia({
      requestId: randomUUID(),
      conversationId: saad.conversationId,
      userId: saad.user.id,
    });

    expect(page.items.length).toBeGreaterThanOrEqual(4);
    const albumItems = page.items.filter((item) => item.caption === saadAlbumCaption);
    expect(albumItems).toHaveLength(3);
    expect(albumItems.every((item) => item.messageAttachmentCount === 3)).toBe(true);
    expect(page.items.some((item) => item.caption === talaAlbumCaption)).toBe(true);
    expect(page.items.every((item) => item.uploadStatus === "ready")).toBe(true);

    const albumMessageId = saadAlbum.id;
    const album = await listReadyMediaForMessage({
      conversationId: saad.conversationId,
      messageId: albumMessageId,
    });
    expect(album).toHaveLength(3);
  });
});
