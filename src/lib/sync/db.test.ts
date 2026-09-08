import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MESSAGE_FIXTURES } from "@/lib/chat/fixtures";
import { draftKey, getChatDb, resetChatDbSingleton } from "@/lib/sync/db";
import { dropPendingStickerSends, getDraft, putCachedMessages, saveDraft } from "@/lib/sync/engine";
import { mergeMessages, type PendingMessage } from "@/lib/sync/merge";

describe("Dexie local chat store", () => {
  beforeEach(async () => {
    resetChatDbSingleton();
    const db = getChatDb();
    await db.pendingMessages.clear();
    await db.cachedMessages.clear();
    await db.drafts.clear();
    await db.syncState.clear();
  });

  afterEach(async () => {
    const db = getChatDb();
    await db.delete();
    resetChatDbSingleton();
  });

  it("persists draft and pending queue offline", async () => {
    const db = getChatDb();
    await db.drafts.put({
      id: draftKey("c1", "u1"),
      conversationId: "c1",
      userId: "u1",
      text: MESSAGE_FIXTURES.arabicFirstMixed,
      updatedAt: new Date().toISOString(),
    });
    const pending: PendingMessage = {
      clientGeneratedId: "33333333-3333-4333-8333-333333333333",
      conversationId: "c1",
      senderId: "u1",
      textContent: MESSAGE_FIXTURES.english,
      status: "queued",
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };
    await db.pendingMessages.put(pending);

    const draft = await db.drafts.get(draftKey("c1", "u1"));
    const queued = await db.pendingMessages.toArray();
    expect(draft?.text).toBe(MESSAGE_FIXTURES.arabicFirstMixed);
    expect(queued).toHaveLength(1);
    expect(mergeMessages([], queued)).toHaveLength(1);
  });

  it("drops pending sends for a sticker that left the library", async () => {
    const db = getChatDb();
    const stickerId = "11111111-1111-4111-8111-111111111111";
    await db.pendingMessages.put({
      clientGeneratedId: "33333333-3333-4333-8333-333333333333",
      conversationId: "c1",
      senderId: "u1",
      textContent: "",
      status: "queued",
      createdAt: new Date().toISOString(),
      retryCount: 3,
      stickerId,
    });
    await db.pendingMessages.put({
      clientGeneratedId: "44444444-4444-4444-8444-444444444444",
      conversationId: "c1",
      senderId: "u1",
      textContent: "keep me",
      status: "queued",
      createdAt: new Date().toISOString(),
      retryCount: 0,
    });
    await dropPendingStickerSends(stickerId);
    const left = await db.pendingMessages.toArray();
    expect(left).toHaveLength(1);
    expect(left[0]?.textContent).toBe("keep me");
  });

  it("restores and clears drafts per user", async () => {
    await saveDraft("c1", "saad", "saad draft");
    await saveDraft("c1", "tala", "tala draft");
    expect(await getDraft("c1", "saad")).toBe("saad draft");
    expect(await getDraft("c1", "tala")).toBe("tala draft");
    await saveDraft("c1", "saad", "");
    expect(await getDraft("c1", "saad")).toBe("");
    expect(await getDraft("c1", "tala")).toBe("tala draft");
  });

  it("caches a voice message including its waveform", async () => {
    const db = getChatDb();
    await putCachedMessages([
      {
        id: "44444444-4444-4444-8444-444444444444",
        conversationId: "c1",
        senderId: "u1",
        clientGeneratedId: "55555555-5555-4555-8555-555555555555",
        type: "audio",
        textContent: "",
        createdAt: new Date().toISOString(),
        editedAt: null,
        deletedAt: null,
        deliveredAt: null,
        readAt: null,
        media: [
          {
            id: "66666666-6666-4666-8666-666666666666",
            sortOrder: 0,
            mimeType: "audio/mp4",
            mediaType: "audio",
            width: null,
            height: null,
            durationMs: 4_200,
            waveform: [16, 40, 80, 40, 16],
            originalSizeBytes: 4_096,
            previewSizeBytes: null,
            originalFilename: "Voice message.m4a",
            uploadStatus: "ready",
            hasPreview: false,
            hasThumbnail: false,
          },
        ],
      },
    ]);
    const stored = await db.cachedMessages.get("44444444-4444-4444-8444-444444444444");
    expect(stored?.type).toBe("audio");
    expect(stored?.media?.[0]?.waveform).toEqual([16, 40, 80, 40, 16]);
  });
});
