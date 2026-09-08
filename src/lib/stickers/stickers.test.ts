import { describe, expect, it } from "vitest";

import { asChatType, serializeMessage, tombstoneMessage } from "@/lib/chat/serialize";
import { messageActionFlags, replyPreviewLabel } from "@/lib/chat/message-actions";
import { buildReplyPreview } from "@/lib/chat/reply-preview";
import type { ChatMessage, StickerRef } from "@/lib/chat/types";
import { pendingToOptimistic, type PendingMessage } from "@/lib/sync/merge";
import { isAnimatedStickerSource, isAnimatedWebpBytes, isGifBytes } from "@/lib/stickers/animated";
import { animatedWebpBytes, STILL_WEBP, TINY_GIF, TINY_PNG } from "@/lib/stickers/fixtures";
import { buildStickerOriginalKey, stickerExtensionForMime } from "@/lib/stickers/object-keys";
import {
  createStickerMetaSchema,
  isValidStickerName,
  MAX_STICKER_NAME_GRAPHEMES,
  normalizeStickerName,
} from "@/lib/stickers/validation";
import { dropStickerFromLibrary } from "@/lib/stickers/list-item";
import type { StickerLibraryPayload, StickerListItem } from "@/lib/stickers/types";
import { sendMessageSchema } from "@/lib/validation/chat";
import { sniffImageMime } from "@/lib/media/validation";

const sticker: StickerRef = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "بحبك",
  animated: false,
  width: 512,
  height: 512,
  archived: false,
  creatorId: "u1",
  saved: false,
};

function msg(partial: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    conversationId: "c1",
    senderId: "u1",
    clientGeneratedId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    type: "sticker",
    textContent: "",
    createdAt: "2026-09-05T12:00:00.000Z",
    editedAt: null,
    deletedAt: null,
    deliveredAt: null,
    readAt: null,
    sticker,
    ...partial,
  };
}

describe("sticker name validation", () => {
  it("accepts Arabic, emoji, and empty names", () => {
    expect(isValidStickerName("بحبك")).toBe(true);
    expect(isValidStickerName("❤️")).toBe(true);
    expect(isValidStickerName("")).toBe(true);
    expect(isValidStickerName("   ")).toBe(true);
    expect(normalizeStickerName("  hi  ")).toBe("hi");
  });

  it("caps names by grapheme, not UTF-16 units", () => {
    const tooLong = "ن".repeat(MAX_STICKER_NAME_GRAPHEMES + 1);
    expect(isValidStickerName(tooLong)).toBe(false);
    expect(isValidStickerName("ن".repeat(MAX_STICKER_NAME_GRAPHEMES))).toBe(true);
    expect(
      createStickerMetaSchema.safeParse({
        id: sticker.id,
        name: tooLong,
        width: 512,
        height: 512,
      }).success,
    ).toBe(false);
  });
});

describe("animated source detection", () => {
  it("sniffs PNG / GIF / WebP and treats GIF plus ANIM WebP as animated", () => {
    expect(sniffImageMime(TINY_PNG)).toBe("image/png");
    expect(sniffImageMime(TINY_GIF)).toBe("image/gif");
    expect(isGifBytes(TINY_GIF)).toBe(true);
    expect(isAnimatedStickerSource(TINY_GIF)).toBe(true);
    expect(isAnimatedStickerSource(TINY_PNG)).toBe(false);
    expect(isAnimatedWebpBytes(STILL_WEBP)).toBe(false);
    expect(isAnimatedStickerSource(animatedWebpBytes())).toBe(true);
  });
});

describe("sticker object keys", () => {
  it("uses the sticker uuid only — never a display name", () => {
    expect(stickerExtensionForMime("image/webp")).toBe("webp");
    const key = buildStickerOriginalKey(sticker.id, "image/webp");
    expect(key).toBe(`stickers/${sticker.id}/original.webp`);
    expect(key.includes("بحبك")).toBe(false);
  });
});

describe("sticker send serialization", () => {
  it("maps sticker as its own chat type and redacts it when deleted", () => {
    expect(asChatType("sticker")).toBe("sticker");
    const serialized = serializeMessage(
      {
        id: "m1",
        conversationId: "c1",
        senderId: "u1",
        clientGeneratedId: "g1",
        type: "sticker",
        textContent: null,
        createdAt: new Date("2026-09-05T12:00:00.000Z"),
        editedAt: null,
        deletedAt: null,
      },
      null,
      [],
      { sticker },
    );
    expect(serialized.type).toBe("sticker");
    expect(serialized.sticker?.id).toBe(sticker.id);

    const deleted = serializeMessage(
      {
        id: "m1",
        conversationId: "c1",
        senderId: "u1",
        clientGeneratedId: "g1",
        type: "sticker",
        textContent: null,
        createdAt: new Date("2026-09-05T12:00:00.000Z"),
        editedAt: null,
        deletedAt: new Date("2026-09-05T12:02:00.000Z"),
      },
      { deliveredAt: new Date(), readAt: new Date() },
      [],
      { sticker },
    );
    expect(deleted.sticker).toBeUndefined();
    expect(tombstoneMessage(serialized, "2026-09-05T12:03:00.000Z").sticker).toBeUndefined();
  });

  it("builds a sticker reply preview from the optional name", () => {
    const preview = buildReplyPreview({
      id: "m1",
      senderId: "u1",
      type: "sticker",
      textContent: null,
      deletedAt: null,
      sticker,
    });
    expect(preview.type).toBe("sticker");
    expect(preview.textSnippet).toBe("بحبك");
    expect(replyPreviewLabel("sticker", preview.textSnippet, false)).toBe("بحبك");
    expect(replyPreviewLabel("sticker", null, false)).toBe("Sticker");
  });
});

describe("sticker send schema and optimistic outbox", () => {
  it("accepts text-or-sticker, never both, never neither", () => {
    expect(
      sendMessageSchema.safeParse({
        text: "hello",
        clientGeneratedId: sticker.id,
      }).success,
    ).toBe(true);
    expect(
      sendMessageSchema.safeParse({
        stickerId: sticker.id,
        clientGeneratedId: sticker.id,
      }).success,
    ).toBe(true);
    expect(
      sendMessageSchema.safeParse({
        text: "hello",
        stickerId: sticker.id,
        clientGeneratedId: sticker.id,
      }).success,
    ).toBe(false);
    expect(
      sendMessageSchema.safeParse({
        clientGeneratedId: sticker.id,
      }).success,
    ).toBe(false);
  });

  it("emits a sticker optimistic row from a pending sticker send", () => {
    const pending: PendingMessage = {
      clientGeneratedId: sticker.id,
      conversationId: "c1",
      senderId: "u1",
      textContent: "",
      status: "queued",
      createdAt: "2026-09-05T12:00:00.000Z",
      retryCount: 0,
      stickerId: sticker.id,
      sticker,
    };
    const optimistic = pendingToOptimistic(pending);
    expect(optimistic.type).toBe("sticker");
    expect(optimistic.sticker?.id).toBe(sticker.id);
    expect(optimistic.textContent).toBe("");
  });
});

describe("sticker action flags", () => {
  it("lets the receiver save, and only the creator rename or archive", () => {
    const received = msg({
      senderId: "u2",
      sticker: { ...sticker, creatorId: "u2", saved: false },
    });
    const own = msg({ senderId: "u1", sticker: { ...sticker, creatorId: "u1" } });
    expect(messageActionFlags(received, "u1")).toMatchObject({
      canSaveSticker: true,
      canUnsaveSticker: false,
      canRenameSticker: false,
    });
    expect(
      messageActionFlags({ ...received, sticker: { ...received.sticker!, saved: true } }, "u1")
        .canUnsaveSticker,
    ).toBe(true);
    expect(messageActionFlags(own, "u1")).toMatchObject({
      canSaveSticker: false,
      canRenameSticker: true,
      canDelete: true,
    });
  });
});

describe("dropStickerFromLibrary", () => {
  it("removes the sticker from every tray section", () => {
    const item: StickerListItem = {
      id: sticker.id,
      name: "بحبك",
      animated: false,
      width: 512,
      height: 512,
      mimeType: "image/webp",
      creatorId: "u1",
      createdAt: "2026-09-05T12:00:00.000Z",
      favorited: true,
      saved: true,
    };
    const payload: StickerLibraryPayload = {
      recent: [item],
      favorites: [item],
      mine: [item],
      partner: [],
      partnerName: "Tala",
    };
    const next = dropStickerFromLibrary(payload, sticker.id);
    expect(next.recent).toEqual([]);
    expect(next.favorites).toEqual([]);
    expect(next.mine).toEqual([]);
    expect(next.partner).toEqual([]);
  });
});
