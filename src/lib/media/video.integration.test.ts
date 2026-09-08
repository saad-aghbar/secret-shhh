import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bootstrapUserBySlot } from "@/lib/auth/bootstrap";
import { getDb } from "@/lib/db";
import {
  messageMedia,
  messages,
  mediaFavorites,
  sharedAlbumItems,
  sharedAlbums,
  videoUploadParts,
  videoUploadSessions,
} from "@/lib/db/schema";
import { createSharedAlbum } from "@/lib/media/albums-service";
import { setMediaFavorite } from "@/lib/media/favorites-service";
import { listSharedConversationMedia } from "@/lib/media/service";
import {
  cancelVideoUpload,
  cleanupExpiredVideoSessions,
  completeVideoUploadAndFinalize,
  getVideoUploadSession,
  initVideoUpload,
  recordVideoPart,
  signVideoParts,
} from "@/lib/media/video-upload-service";
import { searchMessages } from "@/lib/search/query";
import { searchMessagesQuerySchema } from "@/lib/search/validation";
import { resetStorageProviderCache } from "@/lib/storage";
import {
  failNextTestPartUploads,
  resetTestStorage,
  resolveTestPartToken,
  writeTestPart,
} from "@/lib/storage/test-provider";

const canRun = Boolean(process.env.DATABASE_URL);

function fakeMp4(size: number) {
  const body = new Uint8Array(size);
  body[3] = 24;
  body.set([0x66, 0x74, 0x79, 0x70], 4);
  body.set([0x69, 0x73, 0x6f, 0x6d], 8);
  return body;
}

describe.skipIf(!canRun)("phase 6 video integration", () => {
  const createdMessageIds: string[] = [];
  const createdAlbumIds: string[] = [];
  const previousProvider = process.env.STORAGE_PROVIDER;

  beforeAll(() => {
    process.env.STORAGE_PROVIDER = "test";
    resetStorageProviderCache();
    resetTestStorage();
  });

  afterAll(async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const db = getDb();
    const leftover = await db
      .select({ id: videoUploadSessions.id })
      .from(videoUploadSessions)
      .where(
        and(
          eq(videoUploadSessions.uploaderId, saad.user.id),
          inArray(videoUploadSessions.status, ["pending", "uploading", "completing"]),
        ),
      );
    for (const row of leftover) {
      await cancelVideoUpload({
        requestId: randomUUID(),
        userId: saad.user.id,
        sessionId: row.id,
      }).catch(() => undefined);
    }
    process.env.STORAGE_PROVIDER = previousProvider;
    resetStorageProviderCache();
    for (const id of createdAlbumIds) {
      await db.delete(sharedAlbumItems).where(eq(sharedAlbumItems.albumId, id));
      await db.delete(sharedAlbums).where(eq(sharedAlbums.id, id));
    }
    if (createdMessageIds.length > 0) {
      const mediaRows = await db
        .select({ id: messageMedia.id })
        .from(messageMedia)
        .where(inArray(messageMedia.messageId, createdMessageIds));
      const mediaIds = mediaRows.map((row) => row.id);
      if (mediaIds.length > 0) {
        await db.delete(mediaFavorites).where(inArray(mediaFavorites.mediaId, mediaIds));
      }
    }
    for (const id of createdMessageIds) {
      await db.delete(messageMedia).where(eq(messageMedia.messageId, id));
      await db.delete(messages).where(eq(messages.id, id));
    }
  });

  async function completeClip(caption: string) {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const totalBytes = 6 * 1024 * 1024;
    const body = fakeMp4(totalBytes);
    const init = await initVideoUpload({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      clientGeneratedId: randomUUID(),
      clientAssetId: randomUUID(),
      mediaFolderId: randomUUID(),
      filename: "clip.mp4",
      mimeType: "video/mp4",
      size: totalBytes,
      fingerprint: `clip|${Date.now()}|1|${randomUUID().slice(0, 8)}`,
    });
    const signed = await signVideoParts({
      requestId: randomUUID(),
      userId: saad.user.id,
      sessionId: init.sessionId,
      partNumbers: [1],
    });
    const token = signed.parts[0]!.upload.url.split("/").pop()!;
    const etag = writeTestPart(resolveTestPartToken(token)!.uploadId, 1, body);
    await recordVideoPart({
      requestId: randomUUID(),
      userId: saad.user.id,
      sessionId: init.sessionId,
      partNumber: 1,
      etag,
      sizeBytes: totalBytes,
    });
    const message = await completeVideoUploadAndFinalize({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      sessionId: init.sessionId,
      caption,
    });
    createdMessageIds.push(message.id);
    return { saad, message };
  }

  it("init → parts → complete finalizes a video message", async () => {
    resetTestStorage();
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const clientGeneratedId = randomUUID();
    const totalBytes = 6 * 1024 * 1024;
    const body = fakeMp4(totalBytes);

    const init = await initVideoUpload({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      clientGeneratedId,
      clientAssetId: randomUUID(),
      mediaFolderId: randomUUID(),
      filename: "clip.mp4",
      mimeType: "video/mp4",
      size: totalBytes,
      fingerprint: "name|size|1|deadbeef",
    });

    expect(init.totalParts).toBe(1);
    const signed = await signVideoParts({
      requestId: randomUUID(),
      userId: saad.user.id,
      sessionId: init.sessionId,
      partNumbers: [1],
    });
    const token = signed.parts[0]!.upload.url.split("/").pop()!;
    const entry = resolveTestPartToken(token);
    expect(entry?.partNumber).toBe(1);
    const etag = writeTestPart(entry!.uploadId, 1, body);
    await recordVideoPart({
      requestId: randomUUID(),
      userId: saad.user.id,
      sessionId: init.sessionId,
      partNumber: 1,
      etag,
      sizeBytes: totalBytes,
    });

    const message = await completeVideoUploadAndFinalize({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      sessionId: init.sessionId,
      caption: "هاي الفيديو ❤️",
    });
    createdMessageIds.push(message.id);
    expect(message.type).toBe("video");
    expect(message.textContent).toContain("هاي الفيديو");
    expect(message.media?.[0]?.mediaType).toBe("video");
  });

  it("resumes without re-uploading completed parts after an injected failure", async () => {
    resetTestStorage();
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const totalBytes = 16 * 1024 * 1024;
    const body = fakeMp4(totalBytes);
    const init = await initVideoUpload({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      clientGeneratedId: randomUUID(),
      clientAssetId: randomUUID(),
      mediaFolderId: randomUUID(),
      filename: "long.mp4",
      mimeType: "video/mp4",
      size: totalBytes,
      fingerprint: "resume|16|1|abcd",
    });
    expect(init.totalParts).toBe(2);

    const signed = await signVideoParts({
      requestId: randomUUID(),
      userId: saad.user.id,
      sessionId: init.sessionId,
      partNumbers: [1, 2],
    });
    const first = resolveTestPartToken(signed.parts[0]!.upload.url.split("/").pop()!)!;
    writeTestPart(first.uploadId, 1, body.slice(0, init.partSize));
    failNextTestPartUploads(1);

    const info = await getVideoUploadSession({
      requestId: randomUUID(),
      userId: saad.user.id,
      sessionId: init.sessionId,
    });
    expect(info.completedParts.map((part) => part.partNumber)).toEqual([1]);

    writeTestPart(first.uploadId, 2, body.slice(init.partSize));
    const listed = await getVideoUploadSession({
      requestId: randomUUID(),
      userId: saad.user.id,
      sessionId: init.sessionId,
    });
    expect(listed.completedParts.map((part) => part.partNumber).sort()).toEqual([1, 2]);
  });

  it("denies another user signing parts and cancels with abort", async () => {
    resetTestStorage();
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const tala = await bootstrapUserBySlot({ slot: "user_2", displayName: "Tala" });
    const init = await initVideoUpload({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      clientGeneratedId: randomUUID(),
      clientAssetId: randomUUID(),
      mediaFolderId: randomUUID(),
      filename: "clip.mp4",
      mimeType: "video/mp4",
      size: 6 * 1024 * 1024,
      fingerprint: "deny|1|1|ffff",
    });

    await expect(
      signVideoParts({
        requestId: randomUUID(),
        userId: tala.user.id,
        sessionId: init.sessionId,
        partNumbers: [1],
      }),
    ).rejects.toThrow(/not found/i);

    const canceled = await cancelVideoUpload({
      requestId: randomUUID(),
      userId: saad.user.id,
      sessionId: init.sessionId,
    });
    expect(canceled.status).toBe("aborted");

    const db = getDb();
    const row = (
      await db
        .select()
        .from(videoUploadSessions)
        .where(eq(videoUploadSessions.id, init.sessionId))
        .limit(1)
    )[0];
    expect(row?.status).toBe("aborted");
    const parts = await db
      .select()
      .from(videoUploadParts)
      .where(and(eq(videoUploadParts.sessionId, init.sessionId)));
    expect(parts).toHaveLength(0);
  });

  it("complete is idempotent for the same clientGeneratedId", async () => {
    resetTestStorage();
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const clientGeneratedId = randomUUID();
    const totalBytes = 6 * 1024 * 1024;
    const body = fakeMp4(totalBytes);
    const init = await initVideoUpload({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      clientGeneratedId,
      clientAssetId: randomUUID(),
      mediaFolderId: randomUUID(),
      filename: "once.mp4",
      mimeType: "video/mp4",
      size: totalBytes,
      fingerprint: "idemp|1|1|eeee",
    });
    const signed = await signVideoParts({
      requestId: randomUUID(),
      userId: saad.user.id,
      sessionId: init.sessionId,
      partNumbers: [1],
    });
    const token = signed.parts[0]!.upload.url.split("/").pop()!;
    const etag = writeTestPart(resolveTestPartToken(token)!.uploadId, 1, body);
    await recordVideoPart({
      requestId: randomUUID(),
      userId: saad.user.id,
      sessionId: init.sessionId,
      partNumber: 1,
      etag,
      sizeBytes: totalBytes,
    });
    const first = await completeVideoUploadAndFinalize({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      sessionId: init.sessionId,
    });
    createdMessageIds.push(first.id);
    const second = await completeVideoUploadAndFinalize({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      sessionId: init.sessionId,
    });
    expect(second.id).toBe(first.id);
  });

  it("rejects invalid mime and oversize, records parts idempotently, and expires leftover sessions", async () => {
    resetTestStorage();
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    await expect(
      initVideoUpload({
        requestId: randomUUID(),
        userId: saad.user.id,
        conversationId: saad.conversationId,
        clientGeneratedId: randomUUID(),
        clientAssetId: randomUUID(),
        mediaFolderId: randomUUID(),
        filename: "clip.avi",
        mimeType: "video/avi",
        size: 6 * 1024 * 1024,
        fingerprint: "avi|1|1|ffff",
      }),
    ).rejects.toThrow(/format isn't supported/i);

    await expect(
      initVideoUpload({
        requestId: randomUUID(),
        userId: saad.user.id,
        conversationId: saad.conversationId,
        clientGeneratedId: randomUUID(),
        clientAssetId: randomUUID(),
        mediaFolderId: randomUUID(),
        filename: "huge.mp4",
        mimeType: "video/mp4",
        size: 9_000_000_000,
        fingerprint: "huge|1|1|ffff",
      }),
    ).rejects.toThrow(/too large/i);

    const totalBytes = 6 * 1024 * 1024;
    const body = fakeMp4(totalBytes);
    const init = await initVideoUpload({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      clientGeneratedId: randomUUID(),
      clientAssetId: randomUUID(),
      mediaFolderId: randomUUID(),
      filename: "once.mp4",
      mimeType: "video/mp4",
      size: totalBytes,
      fingerprint: "dup-part|1|1|eeee",
    });
    const signed = await signVideoParts({
      requestId: randomUUID(),
      userId: saad.user.id,
      sessionId: init.sessionId,
      partNumbers: [1],
    });
    const token = signed.parts[0]!.upload.url.split("/").pop()!;
    const etag = writeTestPart(resolveTestPartToken(token)!.uploadId, 1, body);
    await recordVideoPart({
      requestId: randomUUID(),
      userId: saad.user.id,
      sessionId: init.sessionId,
      partNumber: 1,
      etag,
      sizeBytes: totalBytes,
    });
    await recordVideoPart({
      requestId: randomUUID(),
      userId: saad.user.id,
      sessionId: init.sessionId,
      partNumber: 1,
      etag,
      sizeBytes: totalBytes,
    });
    const db = getDb();
    const parts = await db
      .select()
      .from(videoUploadParts)
      .where(eq(videoUploadParts.sessionId, init.sessionId));
    expect(parts).toHaveLength(1);

    await db
      .update(videoUploadSessions)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(videoUploadSessions.id, init.sessionId));
    const cleaned = await cleanupExpiredVideoSessions(50);
    expect(cleaned).toBeGreaterThanOrEqual(1);
    const expired = (
      await db
        .select()
        .from(videoUploadSessions)
        .where(eq(videoUploadSessions.id, init.sessionId))
        .limit(1)
    )[0];
    expect(expired?.status).toBe("expired");
  });

  it("lists videos, hearts them, and puts them in a mixed album; search finds the caption", async () => {
    resetTestStorage();
    const caption = `video-lib-${randomUUID().slice(0, 8)}`;
    const { saad, message } = await completeClip(caption);
    const mediaId = message.media?.[0]?.id;
    expect(mediaId).toBeTruthy();

    const videos = await listSharedConversationMedia({
      requestId: randomUUID(),
      conversationId: saad.conversationId,
      userId: saad.user.id,
      mediaType: "video",
    });
    expect(videos.items.some((item) => item.id === mediaId)).toBe(true);
    expect(videos.items.find((item) => item.id === mediaId)?.mediaType).toBe("video");

    const heart = await setMediaFavorite({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      mediaId: mediaId!,
      favorite: true,
    });
    expect(heart.favoritedBy).toContain(saad.user.id);

    const album = await createSharedAlbum({
      requestId: randomUUID(),
      conversationId: saad.conversationId,
      userId: saad.user.id,
      title: `Clips ${caption}`,
      mediaIds: [mediaId!],
    });
    createdAlbumIds.push(album.id);
    expect(album.items.some((item) => item.id === mediaId)).toBe(true);

    const found = await searchMessages({
      requestId: randomUUID(),
      conversationId: saad.conversationId,
      viewerId: saad.user.id,
      query: searchMessagesQuerySchema.parse({ q: caption, type: "videos", tz: "UTC" }),
    });
    expect(found.results.some((row) => row.id === message.id && row.type === "video")).toBe(true);

    const photosOnly = await searchMessages({
      requestId: randomUUID(),
      conversationId: saad.conversationId,
      viewerId: saad.user.id,
      query: searchMessagesQuerySchema.parse({ q: caption, type: "photos", tz: "UTC" }),
    });
    expect(photosOnly.results.some((row) => row.id === message.id)).toBe(false);
  });
});
