import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { bootstrapUserBySlot } from "@/lib/auth/bootstrap";
import {
  MediaValidationError,
  createMediaReadUrl,
  finalizePhotoMessage,
  initMediaUpload,
} from "@/lib/media/service";
import { resetStorageProviderCache } from "@/lib/storage";
import { resetTestStorage, writeTestObject } from "@/lib/storage/test-provider";

const canRun = Boolean(process.env.DATABASE_URL);

describe.skipIf(!canRun)("phase 4 media authorization", () => {
  const previousProvider = process.env.STORAGE_PROVIDER;

  it("rejects spoofed conversation and incomplete finalize", async () => {
    process.env.STORAGE_PROVIDER = "test";
    resetStorageProviderCache();
    resetTestStorage();

    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const fakeConversation = randomUUID();

    await expect(
      initMediaUpload({
        requestId: randomUUID(),
        userId: saad.user.id,
        conversationId: fakeConversation,
        clientGeneratedId: randomUUID(),
        clientAssetId: randomUUID(),
        variant: "original",
        filename: "x.jpg",
        mimeType: "image/jpeg",
        size: 64,
        mediaFolderId: randomUUID(),
      }),
    ).rejects.toThrow(); // FK / validation — must not accept arbitrary conversation

    process.env.STORAGE_PROVIDER = previousProvider;
    resetStorageProviderCache();
  });

  it("denies media URL for unknown media id", async () => {
    process.env.STORAGE_PROVIDER = "test";
    resetStorageProviderCache();
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });

    await expect(
      createMediaReadUrl({
        requestId: randomUUID(),
        userId: saad.user.id,
        conversationId: saad.conversationId,
        mediaId: randomUUID(),
        variant: "thumb",
      }),
    ).rejects.toBeInstanceOf(MediaValidationError);

    process.env.STORAGE_PROVIDER = previousProvider;
    resetStorageProviderCache();
  });

  it("does not finalize when uploads are still pending", async () => {
    process.env.STORAGE_PROVIDER = "test";
    resetStorageProviderCache();
    resetTestStorage();
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const clientGeneratedId = randomUUID();
    const clientAssetId = randomUUID();
    const mediaFolderId = randomUUID();
    const body = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    const original = await initMediaUpload({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      clientGeneratedId,
      clientAssetId,
      variant: "original",
      filename: "x.jpg",
      mimeType: "image/jpeg",
      size: body.byteLength,
      width: 8,
      height: 8,
      mediaFolderId,
    });
    writeTestObject(original.storageKey, body, "image/jpeg");

    // Only original uploaded — preview/thumb missing → finalize must fail
    await expect(
      finalizePhotoMessage({
        requestId: randomUUID(),
        userId: saad.user.id,
        conversationId: saad.conversationId,
        clientGeneratedId,
        assets: [
          {
            clientAssetId,
            sortOrder: 0,
            originalUploadId: original.uploadId,
            previewUploadId: randomUUID(),
            thumbnailUploadId: randomUUID(),
            width: 8,
            height: 8,
            mimeType: "image/jpeg",
            originalFilename: "x.jpg",
          },
        ],
      }),
    ).rejects.toBeInstanceOf(MediaValidationError);

    process.env.STORAGE_PROVIDER = previousProvider;
    resetStorageProviderCache();
  });
});
