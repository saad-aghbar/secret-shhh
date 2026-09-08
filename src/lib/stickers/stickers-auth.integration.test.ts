import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { bootstrapUserBySlot } from "@/lib/auth/bootstrap";
import { sendStickerMessage } from "@/lib/chat/send";
import { resetStorageProviderCache } from "@/lib/storage";
import { resetTestStorage } from "@/lib/storage/test-provider";
import { TINY_PNG } from "@/lib/stickers/fixtures";
import {
  archiveSticker,
  createSticker,
  createStickerReadUrl,
  renameSticker,
  StickerForbiddenError,
  StickerNotFoundError,
} from "@/lib/stickers/service";

const canRun = Boolean(process.env.DATABASE_URL);

describe.skipIf(!canRun)("phase 9 sticker authorization", () => {
  it("blocks spoofed conversations, partner archive, and unknown ids", async () => {
    process.env.STORAGE_PROVIDER = "test";
    resetStorageProviderCache();
    resetTestStorage();

    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const tala = await bootstrapUserBySlot({ slot: "user_2", displayName: "Tala" });

    const sticker = await createSticker({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      bytes: TINY_PNG,
      declaredMime: "image/png",
      meta: {
        id: randomUUID(),
        name: "mine",
        animated: false,
        width: 512,
        height: 512,
      },
    });

    await expect(
      createSticker({
        requestId: randomUUID(),
        userId: saad.user.id,
        conversationId: randomUUID(),
        bytes: TINY_PNG,
        declaredMime: "image/png",
        meta: {
          id: randomUUID(),
          name: null,
          animated: false,
          width: 512,
          height: 512,
        },
      }),
    ).rejects.toBeInstanceOf(StickerForbiddenError);

    await expect(
      archiveSticker({
        requestId: randomUUID(),
        userId: tala.user.id,
        conversationId: tala.conversationId,
        stickerId: sticker.id,
      }),
    ).rejects.toBeInstanceOf(StickerForbiddenError);

    await expect(
      renameSticker({
        requestId: randomUUID(),
        userId: tala.user.id,
        conversationId: tala.conversationId,
        stickerId: sticker.id,
        name: "stolen",
      }),
    ).rejects.toBeInstanceOf(StickerForbiddenError);

    await expect(
      createStickerReadUrl({
        requestId: randomUUID(),
        userId: saad.user.id,
        conversationId: saad.conversationId,
        stickerId: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(StickerNotFoundError);

    await expect(
      sendStickerMessage({
        requestId: randomUUID(),
        userId: tala.user.id,
        conversationId: tala.conversationId,
        stickerId: randomUUID(),
        clientGeneratedId: randomUUID(),
      }),
    ).rejects.toThrow();
  });
});
