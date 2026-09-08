import { and, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { getConversationPartnerId } from "@/lib/chat/access";
import { InteractionError } from "@/lib/chat/interaction-error";
import { assertReplyTarget } from "@/lib/chat/reply-target";
import { getMessageByClientGeneratedId, getMessageById } from "@/lib/chat/queries";
import { serializeMessage } from "@/lib/chat/serialize";
import type { ChatMessage } from "@/lib/chat/types";
import { getDb } from "@/lib/db";
import {
  mediaUploads,
  messageMedia,
  messageReceipts,
  messages,
  videoUploadParts,
  videoUploadSessions,
} from "@/lib/db/schema";
import { logError, logInfo } from "@/lib/logger";
import { mapMediaErrorToConsumer } from "@/lib/media/consumer-errors";
import { MediaValidationError, loadMediaForMessages } from "@/lib/media/service";
import {
  declaredMimeMatchesSniff,
  MAX_CONCURRENT_VIDEO_UPLOADS,
  normalizeMime,
  sanitizeOriginalFilename,
  sniffVideoMime,
  validateVideoUploadMeta,
  VIDEO_UPLOAD_TTL_MS,
} from "@/lib/media/validation";
import {
  assertPartSizeCoversConfiguredMax,
  partByteRange,
  videoPartPlan,
} from "@/lib/media/video-parts";
import { broadcastConversationEvent } from "@/lib/realtime/broadcast";
import { getStorageProvider, maxVideoBytes } from "@/lib/storage";
import { mediaFolderPrefix, objectKeyForVariant } from "@/lib/storage/object-keys";

function isNoSuchUpload(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const code = "Code" in error ? String((error as { Code?: string }).Code) : "";
  const message = error instanceof Error ? error.message : "";
  return name === "NoSuchUpload" || code === "NoSuchUpload" || message.includes("NoSuchUpload");
}

async function requireOwnedSession(userId: string, sessionId: string) {
  const db = getDb();
  const row = (
    await db
      .select()
      .from(videoUploadSessions)
      .where(eq(videoUploadSessions.id, sessionId))
      .limit(1)
  )[0];
  if (!row || row.uploaderId !== userId) {
    throw new MediaValidationError("Upload not found.");
  }
  return row;
}

export async function initVideoUpload(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  clientGeneratedId: string;
  clientAssetId: string;
  mediaFolderId: string;
  filename: string;
  mimeType: string;
  size: number;
  fingerprint: string;
  durationMs?: number;
  width?: number;
  height?: number;
}) {
  assertPartSizeCoversConfiguredMax(maxVideoBytes());
  const validation = validateVideoUploadMeta({ mimeType: params.mimeType, size: params.size });
  if (!validation.ok) {
    throw new MediaValidationError(mapMediaErrorToConsumer(validation.message));
  }

  const db = getDb();
  const existing = (
    await db
      .select()
      .from(videoUploadSessions)
      .where(
        and(
          eq(videoUploadSessions.uploaderId, params.userId),
          eq(videoUploadSessions.clientGeneratedId, params.clientGeneratedId),
        ),
      )
      .limit(1)
  )[0];

  if (existing && (existing.status === "completed" || existing.status === "aborted")) {
    throw new MediaValidationError("That upload is already finished.");
  }

  const active = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(videoUploadSessions)
    .where(
      and(
        eq(videoUploadSessions.uploaderId, params.userId),
        inArray(videoUploadSessions.status, ["pending", "uploading", "completing"]),
      ),
    );
  const activeCount = Number(active[0]?.count ?? 0);
  if (!existing && activeCount >= MAX_CONCURRENT_VIDEO_UPLOADS) {
    throw new MediaValidationError("Wait for a video to finish sending first.");
  }

  const mimeType = normalizeMime(params.mimeType);
  const plan = videoPartPlan(params.size);
  const folder = mediaFolderPrefix(params.conversationId, params.mediaFolderId);
  const storageKey = objectKeyForVariant(folder, "original");
  const expiresAt = new Date(Date.now() + VIDEO_UPLOAD_TTL_MS);
  const storage = getStorageProvider();

  if (existing && existing.status !== "expired") {
    const sameFile =
      existing.fingerprint === params.fingerprint &&
      existing.totalBytes === params.size &&
      existing.mimeType === mimeType;
    if (sameFile && existing.expiresAt.getTime() > Date.now()) {
      try {
        await storage.listMultipartParts({
          key: existing.storageKey,
          uploadId: existing.providerUploadId,
        });
        logInfo({
          requestId: params.requestId,
          operation: "initVideoUpload",
          userId: params.userId,
          extra: { sessionId: existing.id, resumed: true },
        });
        return {
          sessionId: existing.id,
          partSize: existing.partSize,
          totalParts: existing.totalParts,
          totalBytes: existing.totalBytes,
          expiresAt: existing.expiresAt.toISOString(),
        };
      } catch (error) {
        if (!isNoSuchUpload(error)) throw error;
        await db
          .update(videoUploadSessions)
          .set({ status: "expired", updatedAt: new Date() })
          .where(eq(videoUploadSessions.id, existing.id));
      }
    }
  }

  const created = await storage.createMultipartUpload({
    key: existing && existing.fingerprint === params.fingerprint ? existing.storageKey : storageKey,
    contentType: mimeType,
  });
  const keyToUse =
    existing && existing.fingerprint === params.fingerprint ? existing.storageKey : storageKey;

  let row = existing;
  if (!row) {
    const inserted = await db
      .insert(videoUploadSessions)
      .values({
        uploaderId: params.userId,
        conversationId: params.conversationId,
        clientGeneratedId: params.clientGeneratedId,
        clientAssetId: params.clientAssetId,
        mediaFolderId: params.mediaFolderId,
        storageKey: keyToUse,
        providerUploadId: created.uploadId,
        originalFilename: sanitizeOriginalFilename(params.filename),
        mimeType,
        totalBytes: params.size,
        partSize: plan.partSize,
        totalParts: plan.totalParts,
        fingerprint: params.fingerprint,
        durationMs: params.durationMs,
        width: params.width,
        height: params.height,
        status: "pending",
        expiresAt,
      })
      .returning();
    row = inserted[0]!;
  } else {
    await db.delete(videoUploadParts).where(eq(videoUploadParts.sessionId, row.id));
    const updated = await db
      .update(videoUploadSessions)
      .set({
        clientAssetId: params.clientAssetId,
        mediaFolderId: params.mediaFolderId,
        storageKey: keyToUse,
        providerUploadId: created.uploadId,
        originalFilename: sanitizeOriginalFilename(params.filename),
        mimeType,
        totalBytes: params.size,
        partSize: plan.partSize,
        totalParts: plan.totalParts,
        fingerprint: params.fingerprint,
        durationMs: params.durationMs,
        width: params.width,
        height: params.height,
        status: "pending",
        expiresAt,
        updatedAt: new Date(),
        completedAt: null,
      })
      .where(eq(videoUploadSessions.id, row.id))
      .returning();
    row = updated[0]!;
  }

  logInfo({
    requestId: params.requestId,
    operation: "initVideoUpload",
    userId: params.userId,
    extra: { sessionId: row.id, totalParts: row.totalParts, storage: storage.name },
  });

  return {
    sessionId: row.id,
    partSize: row.partSize,
    totalParts: row.totalParts,
    totalBytes: row.totalBytes,
    expiresAt: row.expiresAt.toISOString(),
  };
}

export async function signVideoParts(params: {
  requestId: string;
  userId: string;
  sessionId: string;
  partNumbers: number[];
}) {
  const row = await requireOwnedSession(params.userId, params.sessionId);
  if (row.status === "aborted" || row.status === "expired") {
    throw new MediaValidationError("That upload was cancelled.");
  }
  if (row.status === "completed") {
    throw new MediaValidationError("That upload is already finished.");
  }
  if (row.expiresAt.getTime() < Date.now()) {
    throw new MediaValidationError("That upload link expired. Try again.");
  }

  const unique = [...new Set(params.partNumbers)];
  for (const partNumber of unique) {
    if (partNumber < 1 || partNumber > row.totalParts) {
      throw new MediaValidationError("That video part isn't valid.");
    }
  }

  const storage = getStorageProvider();
  const parts = await Promise.all(
    unique.map(async (partNumber) => {
      const signed = await storage.createSignedPartUploadUrl({
        key: row.storageKey,
        uploadId: row.providerUploadId,
        partNumber,
        contentType: "application/octet-stream",
      });
      return { partNumber, upload: signed };
    }),
  );

  await getDb()
    .update(videoUploadSessions)
    .set({ status: "uploading", updatedAt: new Date() })
    .where(eq(videoUploadSessions.id, row.id));

  return { sessionId: row.id, parts };
}

export async function recordVideoPart(params: {
  requestId: string;
  userId: string;
  sessionId: string;
  partNumber: number;
  etag: string;
  sizeBytes: number;
}) {
  const row = await requireOwnedSession(params.userId, params.sessionId);
  if (row.status === "aborted" || row.status === "expired" || row.status === "completed") {
    throw new MediaValidationError("That upload was cancelled.");
  }
  if (params.partNumber < 1 || params.partNumber > row.totalParts) {
    throw new MediaValidationError("That video part isn't valid.");
  }
  const expected = partByteRange(row.totalBytes, row.partSize, params.partNumber);
  if (params.sizeBytes !== expected.size) {
    throw new MediaValidationError("Couldn't send · Tap to retry");
  }

  const db = getDb();
  await db
    .insert(videoUploadParts)
    .values({
      sessionId: row.id,
      partNumber: params.partNumber,
      sizeBytes: params.sizeBytes,
      etag: params.etag,
    })
    .onConflictDoUpdate({
      target: [videoUploadParts.sessionId, videoUploadParts.partNumber],
      set: {
        sizeBytes: params.sizeBytes,
        etag: params.etag,
        completedAt: new Date(),
      },
    });

  return { sessionId: row.id, partNumber: params.partNumber };
}

export async function getVideoUploadSession(params: {
  requestId: string;
  userId: string;
  sessionId: string;
}) {
  const row = await requireOwnedSession(params.userId, params.sessionId);
  const storage = getStorageProvider();
  let providerParts: Array<{ partNumber: number; etag: string; sizeBytes?: number }> = [];
  let providerAlive = true;
  try {
    providerParts = await storage.listMultipartParts({
      key: row.storageKey,
      uploadId: row.providerUploadId,
    });
  } catch (error) {
    if (isNoSuchUpload(error) || row.status === "completed") {
      providerAlive = row.status === "completed";
      if (row.status !== "completed") providerAlive = false;
    } else {
      throw error;
    }
  }

  const uploadedBytes = providerParts.reduce((sum, part) => sum + (part.sizeBytes ?? 0), 0);

  return {
    sessionId: row.id,
    status: row.status,
    partSize: row.partSize,
    totalParts: row.totalParts,
    totalBytes: row.totalBytes,
    fingerprint: row.fingerprint,
    completedParts: providerParts.map((part) => ({
      partNumber: part.partNumber,
      etag: part.etag,
      sizeBytes: part.sizeBytes ?? null,
    })),
    uploadedBytes,
    providerAlive,
    expiresAt: row.expiresAt.toISOString(),
  };
}

export async function cancelVideoUpload(params: {
  requestId: string;
  userId: string;
  sessionId: string;
}) {
  const row = await requireOwnedSession(params.userId, params.sessionId);
  if (row.status === "completed") {
    throw new MediaValidationError("That video is already part of a message.");
  }
  const storage = getStorageProvider();
  if (row.status !== "aborted" && row.status !== "expired") {
    await storage
      .abortMultipartUpload({
        key: row.storageKey,
        uploadId: row.providerUploadId,
      })
      .catch(() => undefined);
  }
  await getDb()
    .update(videoUploadSessions)
    .set({ status: "aborted", updatedAt: new Date(), completedAt: new Date() })
    .where(eq(videoUploadSessions.id, row.id));

  logInfo({
    requestId: params.requestId,
    operation: "cancelVideoUpload",
    userId: params.userId,
    extra: { sessionId: row.id },
  });

  return { sessionId: row.id, status: "aborted" as const };
}

export async function completeVideoUploadAndFinalize(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  sessionId: string;
  caption?: string;
  previewUploadId?: string;
  thumbnailUploadId?: string;
  durationMs?: number;
  width?: number;
  height?: number;
  replyToMessageId?: string;
}): Promise<ChatMessage> {
  const started = Date.now();
  const row = await requireOwnedSession(params.userId, params.sessionId);
  if (row.conversationId !== params.conversationId) {
    throw new MediaValidationError("Upload conversation mismatch.");
  }

  const existingMessage = await getMessageByClientGeneratedId(
    params.userId,
    row.clientGeneratedId,
    params.userId,
  );
  if (existingMessage) return existingMessage;

  if (row.status === "aborted" || row.status === "expired") {
    throw new MediaValidationError("That upload was cancelled.");
  }

  const db = getDb();
  const storage = getStorageProvider();

  if (row.status !== "completed") {
    const listed = await storage.listMultipartParts({
      key: row.storageKey,
      uploadId: row.providerUploadId,
    });
    if (listed.length !== row.totalParts) {
      throw new MediaValidationError("Couldn't send · Tap to retry");
    }
    const listedBytes = listed.reduce((sum, part) => sum + (part.sizeBytes ?? 0), 0);
    if (listedBytes !== row.totalBytes) {
      throw new MediaValidationError("Couldn't send · Tap to retry");
    }
    for (let i = 1; i <= row.totalParts; i += 1) {
      if (!listed.some((part) => part.partNumber === i)) {
        throw new MediaValidationError("Couldn't send · Tap to retry");
      }
    }

    await db
      .update(videoUploadSessions)
      .set({ status: "completing", updatedAt: new Date() })
      .where(eq(videoUploadSessions.id, row.id));

    await storage.completeMultipartUpload({
      key: row.storageKey,
      uploadId: row.providerUploadId,
      parts: listed.map((part) => ({ partNumber: part.partNumber, etag: part.etag })),
    });

    const head = await storage.getObjectRange(row.storageKey, 0, 63);
    const sniffed = head ? sniffVideoMime(head) : null;
    if (!declaredMimeMatchesSniff(row.mimeType, sniffed)) {
      await storage.deleteObject(row.storageKey).catch(() => undefined);
      throw new MediaValidationError("This video format isn't supported yet.");
    }

    await db
      .update(videoUploadSessions)
      .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(videoUploadSessions.id, row.id));
  }

  const posterIds = [params.previewUploadId, params.thumbnailUploadId].filter((id): id is string =>
    Boolean(id),
  );
  const posterRows =
    posterIds.length > 0
      ? await db.select().from(mediaUploads).where(inArray(mediaUploads.id, posterIds))
      : [];
  const posters = new Map(posterRows.map((item) => [item.id, item]));
  for (const [id, expected] of [
    [params.previewUploadId, "preview"],
    [params.thumbnailUploadId, "thumbnail"],
  ] as const) {
    if (!id) continue;
    const poster = posters.get(id);
    if (!poster || poster.uploaderId !== params.userId) {
      throw new MediaValidationError("Upload not found.");
    }
    if (poster.clientGeneratedId !== row.clientGeneratedId) {
      throw new MediaValidationError("Upload message mismatch.");
    }
    if (poster.variant !== expected || poster.status !== "uploaded") {
      throw new MediaValidationError("Couldn't prepare this video.");
    }
  }

  if (params.replyToMessageId) {
    try {
      await assertReplyTarget({
        conversationId: params.conversationId,
        replyToMessageId: params.replyToMessageId,
      });
    } catch (error) {
      if (error instanceof InteractionError) {
        throw new MediaValidationError(error.message);
      }
      throw error;
    }
  }

  const partnerId = await getConversationPartnerId(params.conversationId, params.userId);
  const caption = params.caption?.trim() ? params.caption.trim() : null;
  const preview = params.previewUploadId ? posters.get(params.previewUploadId) : null;
  const thumb = params.thumbnailUploadId ? posters.get(params.thumbnailUploadId) : null;

  try {
    const inserted = await db.transaction(async (tx) => {
      const [messageRow] = await tx
        .insert(messages)
        .values({
          conversationId: params.conversationId,
          senderId: params.userId,
          clientGeneratedId: row.clientGeneratedId,
          type: "video",
          textContent: caption,
          replyToMessageId: params.replyToMessageId,
          metadata: {},
        })
        .onConflictDoNothing({
          target: [messages.senderId, messages.clientGeneratedId],
        })
        .returning();

      const message =
        messageRow ??
        (
          await tx
            .select()
            .from(messages)
            .where(
              and(
                eq(messages.senderId, params.userId),
                eq(messages.clientGeneratedId, row.clientGeneratedId),
              ),
            )
            .limit(1)
        )[0];

      if (!message) throw new Error("insert_failed");

      if (messageRow) {
        await tx.insert(messageMedia).values({
          messageId: message.id,
          uploaderId: params.userId,
          storageKey: row.storageKey,
          previewStorageKey: preview?.storageKey ?? null,
          thumbnailStorageKey: thumb?.storageKey ?? null,
          originalFilename: sanitizeOriginalFilename(row.originalFilename ?? "video"),
          mimeType: row.mimeType,
          mediaType: "video",
          width: params.width ?? row.width,
          height: params.height ?? row.height,
          durationMs: params.durationMs ?? row.durationMs,
          originalSizeBytes: row.totalBytes,
          previewSizeBytes: preview?.sizeBytes ?? null,
          checksum: row.fingerprint,
          uploadStatus: "ready",
          sortOrder: 0,
        });

        if (posterIds.length > 0) {
          await tx
            .update(mediaUploads)
            .set({ status: "consumed" })
            .where(inArray(mediaUploads.id, posterIds));
        }

        if (partnerId) {
          await tx
            .insert(messageReceipts)
            .values({
              messageId: message.id,
              userId: partnerId,
            })
            .onConflictDoNothing({
              target: [messageReceipts.messageId, messageReceipts.userId],
            });
        }
      }

      return message;
    });

    const serialized =
      (await getMessageById(params.conversationId, params.userId, inserted.id)) ??
      serializeMessage(inserted, { deliveredAt: null, readAt: null }, []);

    logInfo({
      requestId: params.requestId,
      operation: "completeVideoUploadAndFinalize",
      userId: params.userId,
      durationMs: Date.now() - started,
      extra: { sessionId: row.id },
    });

    void broadcastConversationEvent(params.conversationId, "message:new", {
      messageId: serialized.id,
    });
    void broadcastConversationEvent(params.conversationId, "media:changed", {
      messageId: serialized.id,
    });
    void cleanupExpiredVideoSessions(10).catch(() => undefined);

    return serialized;
  } catch (error) {
    logError({
      requestId: params.requestId,
      operation: "completeVideoUploadAndFinalize",
      userId: params.userId,
      errorClass: error instanceof Error ? error.name : "unknown",
      durationMs: Date.now() - started,
    });
    throw error;
  }
}

export async function cleanupExpiredVideoSessions(limit = 25) {
  const db = getDb();
  const storage = getStorageProvider();
  const rows = await db
    .select()
    .from(videoUploadSessions)
    .where(inArray(videoUploadSessions.status, ["pending", "uploading", "completing"]))
    .limit(limit);

  let cleaned = 0;
  for (const row of rows) {
    if (row.expiresAt.getTime() >= Date.now()) continue;
    await storage
      .abortMultipartUpload({
        key: row.storageKey,
        uploadId: row.providerUploadId,
      })
      .catch(() => undefined);
    const posters = await db
      .select()
      .from(mediaUploads)
      .where(
        and(
          eq(mediaUploads.clientGeneratedId, row.clientGeneratedId),
          inArray(mediaUploads.status, ["pending", "uploaded"]),
        ),
      );
    for (const poster of posters) {
      await storage.deleteObject(poster.storageKey).catch(() => undefined);
      await db
        .update(mediaUploads)
        .set({ status: "aborted" })
        .where(eq(mediaUploads.id, poster.id));
    }
    await db
      .update(videoUploadSessions)
      .set({ status: "expired", updatedAt: new Date() })
      .where(eq(videoUploadSessions.id, row.id));
    cleaned += 1;
  }
  return cleaned;
}

export function newVideoClientIds() {
  return {
    clientGeneratedId: randomUUID(),
    clientAssetId: randomUUID(),
    mediaFolderId: randomUUID(),
  };
}
