import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bootstrapUserBySlot } from "@/lib/auth/bootstrap";
import { getMessagesAfter, getRecentMessages } from "@/lib/chat/queries";
import { getDb } from "@/lib/db";
import { mediaUploads, messageMedia, messages } from "@/lib/db/schema";
import { getMessagesOnDay, getMonthActivity } from "@/lib/history/queries";
import { createSharedAlbum } from "@/lib/media/albums-service";
import {
  completeMediaUpload,
  createMediaReadUrl,
  finalizeVoiceMessage,
  getAuthorizedMediaBytes,
  initVoiceUpload,
  listSharedConversationMedia,
} from "@/lib/media/service";
import { VOICE_WAVEFORM_BUCKETS } from "@/lib/media/validation";
import { searchMessages } from "@/lib/search/query";
import { searchMessagesQuerySchema } from "@/lib/search/validation";
import { getStorageProvider, resetStorageProviderCache } from "@/lib/storage";
import { resetTestStorage, writeTestObject } from "@/lib/storage/test-provider";

const canRun = Boolean(process.env.DATABASE_URL);

/** A minimal WebM/EBML header so the server's sniff agrees with the declaration. */
function fakeWebm(size = 4_096) {
  const body = new Uint8Array(size);
  body.set([0x1a, 0x45, 0xdf, 0xa3], 0);
  return body;
}

function fakeMp4(size = 4_096) {
  const body = new Uint8Array(size);
  body[3] = 24;
  body.set([0x66, 0x74, 0x79, 0x70], 4);
  body.set([0x4d, 0x34, 0x41, 0x20], 8);
  return body;
}

const waveform = Array.from({ length: VOICE_WAVEFORM_BUCKETS }, (_, i) => 6 + (i % 90));

describe.skipIf(!canRun)("phase 7 voice integration", () => {
  const createdMessageIds: string[] = [];
  const createdAlbumIds: string[] = [];
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
      await db.delete(messageMedia).where(eq(messageMedia.messageId, id));
      await db.delete(messages).where(eq(messages.id, id));
    }
    for (const id of createdAlbumIds) {
      const { sharedAlbumItems, sharedAlbums } = await import("@/lib/db/schema");
      await db.delete(sharedAlbumItems).where(eq(sharedAlbumItems.albumId, id));
      await db.delete(sharedAlbums).where(eq(sharedAlbums.id, id));
    }
  });

  async function sendVoice(
    options: {
      durationMs?: number;
      mimeType?: string;
      bytes?: Uint8Array;
      slot?: "user_1" | "user_2";
    } = {},
  ) {
    const slot = options.slot ?? "user_1";
    const account = await bootstrapUserBySlot({
      slot,
      displayName: slot === "user_1" ? "Saad" : "Partner",
    });
    const clientGeneratedId = randomUUID();
    const clientAssetId = randomUUID();
    const mimeType = options.mimeType ?? "audio/webm";
    const bytes = options.bytes ?? fakeWebm();

    const init = await initVoiceUpload({
      requestId: randomUUID(),
      userId: account.user.id,
      conversationId: account.conversationId,
      clientGeneratedId,
      clientAssetId,
      mediaFolderId: randomUUID(),
      mimeType,
      size: bytes.byteLength,
    });
    expect(init.upload).not.toBeNull();

    writeTestObject(init.storageKey, bytes, mimeType);
    await completeMediaUpload({
      requestId: randomUUID(),
      userId: account.user.id,
      uploadId: init.uploadId,
    });

    const message = await finalizeVoiceMessage({
      requestId: randomUUID(),
      userId: account.user.id,
      conversationId: account.conversationId,
      clientGeneratedId,
      uploadId: init.uploadId,
      durationMs: options.durationMs ?? 4_200,
      waveform,
    });
    createdMessageIds.push(message.id);
    return { account, message, clientGeneratedId, clientAssetId, init };
  }

  it("init → put → complete → finalize creates an audio message with duration and bars", async () => {
    resetTestStorage();
    const { message } = await sendVoice({ durationMs: 4_200 });

    expect(message.type).toBe("audio");
    expect(message.textContent).toBe("");
    expect(message.media?.length).toBe(1);
    const media = message.media?.[0];
    expect(media?.mediaType).toBe("audio");
    expect(media?.durationMs).toBe(4_200);
    expect(media?.waveform).toEqual(waveform);
    expect(media?.mimeType).toBe("audio/webm");
    // No visual derivatives are produced for voice.
    expect(media?.hasThumbnail).toBeFalsy();
    expect(media?.hasPreview).toBeFalsy();
  });

  it("is idempotent, so a retry after a dropped response sends one voice note", async () => {
    resetTestStorage();
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const clientGeneratedId = randomUUID();
    const clientAssetId = randomUUID();
    const bytes = fakeWebm();

    const init = await initVoiceUpload({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      clientGeneratedId,
      clientAssetId,
      mediaFolderId: randomUUID(),
      mimeType: "audio/webm",
      size: bytes.byteLength,
    });
    writeTestObject(init.storageKey, bytes, "audio/webm");
    await completeMediaUpload({
      requestId: randomUUID(),
      userId: saad.user.id,
      uploadId: init.uploadId,
    });

    const first = await finalizeVoiceMessage({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      clientGeneratedId,
      uploadId: init.uploadId,
      durationMs: 3_000,
      waveform,
    });
    createdMessageIds.push(first.id);

    const second = await finalizeVoiceMessage({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      clientGeneratedId,
      uploadId: init.uploadId,
      durationMs: 3_000,
      waveform,
    });

    expect(second.id).toBe(first.id);
    const db = getDb();
    const rows = await db
      .select({ id: messageMedia.id })
      .from(messageMedia)
      .where(eq(messageMedia.messageId, first.id));
    expect(rows).toHaveLength(1);
  });

  it("skips re-uploading bytes when a retry finds the recording already stored", async () => {
    resetTestStorage();
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const clientGeneratedId = randomUUID();
    const clientAssetId = randomUUID();
    const bytes = fakeWebm();
    const args = {
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      clientGeneratedId,
      clientAssetId,
      mediaFolderId: randomUUID(),
      mimeType: "audio/webm",
      size: bytes.byteLength,
    };

    const init = await initVoiceUpload(args);
    writeTestObject(init.storageKey, bytes, "audio/webm");
    await completeMediaUpload({
      requestId: randomUUID(),
      userId: saad.user.id,
      uploadId: init.uploadId,
    });

    // The finalize response was lost; the queue re-runs the whole job.
    const resumed = await initVoiceUpload({ ...args, requestId: randomUUID() });
    expect(resumed.uploadId).toBe(init.uploadId);
    expect(resumed.upload).toBeNull();

    const message = await finalizeVoiceMessage({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      clientGeneratedId,
      uploadId: resumed.uploadId,
      durationMs: 5_000,
      waveform,
    });
    createdMessageIds.push(message.id);
    expect(message.type).toBe("audio");
  });

  it("refuses bytes whose container contradicts the declared type", async () => {
    resetTestStorage();
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const clientGeneratedId = randomUUID();
    const bytes = fakeWebm();

    const init = await initVoiceUpload({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      clientGeneratedId,
      clientAssetId: randomUUID(),
      mediaFolderId: randomUUID(),
      mimeType: "audio/mp4",
      size: bytes.byteLength,
    });
    // Declared m4a, actually WebM.
    writeTestObject(init.storageKey, bytes, "audio/mp4");
    await completeMediaUpload({
      requestId: randomUUID(),
      userId: saad.user.id,
      uploadId: init.uploadId,
    });

    await expect(
      finalizeVoiceMessage({
        requestId: randomUUID(),
        userId: saad.user.id,
        conversationId: saad.conversationId,
        clientGeneratedId,
        uploadId: init.uploadId,
        durationMs: 3_000,
        waveform,
      }),
    ).rejects.toThrow(/audio format/u);

    const db = getDb();
    const row = (
      await db.select().from(mediaUploads).where(eq(mediaUploads.id, init.uploadId)).limit(1)
    )[0];
    expect(row?.status).toBe("aborted");
  });

  it("refuses an unsupported audio format before any bytes are uploaded", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    await expect(
      initVoiceUpload({
        requestId: randomUUID(),
        userId: saad.user.id,
        conversationId: saad.conversationId,
        clientGeneratedId: randomUUID(),
        clientAssetId: randomUUID(),
        mediaFolderId: randomUUID(),
        mimeType: "audio/wav",
        size: 4_096,
      }),
    ).rejects.toThrow(/format isn't supported/u);
  });

  it("refuses to finalize when the stored object is gone", async () => {
    resetTestStorage();
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const clientGeneratedId = randomUUID();
    const bytes = fakeWebm();
    const init = await initVoiceUpload({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      clientGeneratedId,
      clientAssetId: randomUUID(),
      mediaFolderId: randomUUID(),
      mimeType: "audio/webm",
      size: bytes.byteLength,
    });
    writeTestObject(init.storageKey, bytes, "audio/webm");
    await completeMediaUpload({
      requestId: randomUUID(),
      userId: saad.user.id,
      uploadId: init.uploadId,
    });
    await getStorageProvider().deleteObject(init.storageKey);

    await expect(
      finalizeVoiceMessage({
        requestId: randomUUID(),
        userId: saad.user.id,
        conversationId: saad.conversationId,
        clientGeneratedId,
        uploadId: init.uploadId,
        durationMs: 3_000,
        waveform,
      }),
    ).rejects.toThrow(/gone/u);
  });

  it("refuses to finalize a recording whose bytes never landed", async () => {
    resetTestStorage();
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const clientGeneratedId = randomUUID();
    const init = await initVoiceUpload({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      clientGeneratedId,
      clientAssetId: randomUUID(),
      mediaFolderId: randomUUID(),
      mimeType: "audio/webm",
      size: 4_096,
    });

    await expect(
      finalizeVoiceMessage({
        requestId: randomUUID(),
        userId: saad.user.id,
        conversationId: saad.conversationId,
        clientGeneratedId,
        uploadId: init.uploadId,
        durationMs: 3_000,
        waveform,
      }),
    ).rejects.toThrow(/still uploading/u);
  });

  it("refuses to finalize somebody else's upload", async () => {
    resetTestStorage();
    const { init, clientGeneratedId } = await (async () => {
      const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
      const id = randomUUID();
      const bytes = fakeWebm();
      const created = await initVoiceUpload({
        requestId: randomUUID(),
        userId: saad.user.id,
        conversationId: saad.conversationId,
        clientGeneratedId: id,
        clientAssetId: randomUUID(),
        mediaFolderId: randomUUID(),
        mimeType: "audio/webm",
        size: bytes.byteLength,
      });
      writeTestObject(created.storageKey, bytes, "audio/webm");
      await completeMediaUpload({
        requestId: randomUUID(),
        userId: saad.user.id,
        uploadId: created.uploadId,
      });
      return { init: created, clientGeneratedId: id };
    })();

    const partner = await bootstrapUserBySlot({ slot: "user_2", displayName: "Partner" });
    await expect(
      finalizeVoiceMessage({
        requestId: randomUUID(),
        userId: partner.user.id,
        conversationId: partner.conversationId,
        clientGeneratedId,
        uploadId: init.uploadId,
        durationMs: 3_000,
        waveform,
      }),
    ).rejects.toThrow(/Upload not found/u);
  });

  it("accepts an m4a recording from an iPhone", async () => {
    resetTestStorage();
    const { message } = await sendVoice({ mimeType: "audio/mp4", bytes: fakeMp4() });
    expect(message.media?.[0]?.mimeType).toBe("audio/mp4");
  });

  it("serves the original privately, with a friendly download name", async () => {
    resetTestStorage();
    const { account, message } = await sendVoice();
    const mediaId = message.media?.[0]?.id ?? "";

    const url = await createMediaReadUrl({
      requestId: randomUUID(),
      userId: account.user.id,
      conversationId: account.conversationId,
      mediaId,
      variant: "original",
    });
    // Private bytes: a proxied, expiring URL, never a public bucket link.
    expect(url.url).not.toMatch(/r2\.cloudflarestorage|public/u);
    const ttlMs = new Date(url.expiresAt).getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(5 * 60 * 60 * 1_000);
    expect(ttlMs).toBeLessThanOrEqual(6 * 60 * 60 * 1_000 + 5_000);

    const bytes = await getAuthorizedMediaBytes({
      requestId: randomUUID(),
      userId: account.user.id,
      conversationId: account.conversationId,
      mediaId,
      variant: "original",
    });
    expect(bytes.filename).toMatch(/^Voice message/u);
    expect(bytes.contentType).toBe("audio/webm");
    expect(bytes.bytes.byteLength).toBe(4_096);
  });

  it("refuses to serve a recording to anyone outside the conversation", async () => {
    resetTestStorage();
    const { message } = await sendVoice();
    const mediaId = message.media?.[0]?.id ?? "";
    await expect(
      getAuthorizedMediaBytes({
        requestId: randomUUID(),
        userId: randomUUID(),
        conversationId: randomUUID(),
        mediaId,
        variant: "original",
      }),
    ).rejects.toThrow(/Couldn't find that/u);
  });

  it("stays out of the shared media library and cannot be added to an album", async () => {
    resetTestStorage();
    const { account, message } = await sendVoice();
    const mediaId = message.media?.[0]?.id ?? "";

    const library = await listSharedConversationMedia({
      requestId: randomUUID(),
      userId: account.user.id,
      conversationId: account.conversationId,
      limit: 100,
    });
    expect(library.items.some((item) => item.id === mediaId)).toBe(false);

    // The picker only ever offers photos and videos, so a voice id here is a
    // crafted request — it is rejected rather than quietly dropped.
    await expect(
      createSharedAlbum({
        requestId: randomUUID(),
        userId: account.user.id,
        conversationId: account.conversationId,
        title: `Voice audit ${randomUUID().slice(0, 8)}`,
        mediaIds: [mediaId],
      }),
    ).rejects.toThrow(/aren't available/u);
  });

  it("is findable with the Voice filter, and never by words", async () => {
    resetTestStorage();
    const { account, message } = await sendVoice();

    const search = (query: Record<string, unknown>) =>
      searchMessages({
        requestId: randomUUID(),
        conversationId: account.conversationId,
        viewerId: account.user.id,
        query: searchMessagesQuerySchema.parse(query),
      });

    const voiceOnly = await search({ type: "voice", limit: 50 });
    const found = voiceOnly.results.find((item) => item.id === message.id);
    expect(found).toBeDefined();
    expect(found?.type).toBe("audio");
    expect(found?.snippet).toBe("Voice message");

    const photosOnly = await search({ type: "photos", limit: 50 });
    expect(photosOnly.results.some((item) => item.id === message.id)).toBe(false);

    const textOnly = await search({ type: "text", limit: 50 });
    expect(textOnly.results.some((item) => item.id === message.id)).toBe(false);

    // No transcription: words never match a recording.
    const words = await search({ q: "voice", type: "voice", limit: 50 });
    expect(words.results.some((item) => item.id === message.id)).toBe(false);
  });

  it("appears in the day view and counts toward the calendar day", async () => {
    resetTestStorage();
    const { account, message } = await sendVoice();
    const today = new Date().toISOString().slice(0, 10);

    const day = await getMessagesOnDay({
      conversationId: account.conversationId,
      viewerId: account.user.id,
      date: today,
      timeZone: "UTC",
    });
    const row = day.find((item) => item.id === message.id);
    expect(row?.type).toBe("audio");

    // A day with only voice notes must still light up on the calendar.
    const activity = await getMonthActivity({
      conversationId: account.conversationId,
      year: Number(today.slice(0, 4)),
      month: Number(today.slice(5, 7)),
      timeZone: "UTC",
    });
    const dayCount = activity.find((entry) => entry.date === today)?.count ?? 0;
    expect(dayCount).toBeGreaterThan(0);
  });

  it(
    "is reachable from the chat thread with its bars and duration",
    async () => {
      resetTestStorage();
      const { account, message } = await sendVoice({ durationMs: 9_100 });
      const page = await getRecentMessages(account.conversationId, account.user.id, 30);
      const row = page.messages.find((item) => item.id === message.id);
      expect(row?.type).toBe("audio");
      expect(row?.media?.[0]?.durationMs).toBe(9_100);
      expect(row?.media?.[0]?.waveform).toEqual(waveform);
      expect(row?.media?.[0]?.mediaType).toBe("audio");
    },
    20_000,
  );

  it("lands in cursor sync for the partner, with media attached", async () => {
    resetTestStorage();
    const first = await sendVoice({ durationMs: 3_000 });
    const second = await sendVoice({ durationMs: 5_000, slot: "user_2" });
    const partner = first.account;
    const after = await getMessagesAfter(
      partner.conversationId,
      partner.user.id,
      first.message.id,
      20,
    );
    expect(after.messages.some((item) => item.id === first.message.id)).toBe(false);
    const incoming = after.messages.find((item) => item.id === second.message.id);
    expect(incoming?.type).toBe("audio");
    expect(incoming?.media?.[0]?.durationMs).toBe(5_000);
    expect(incoming?.media?.[0]?.waveform).toHaveLength(VOICE_WAVEFORM_BUCKETS);
  });
});
