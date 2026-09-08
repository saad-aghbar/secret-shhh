import { and, asc, desc, eq, gt, gte, inArray, lt, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { authorizeConversationAccess, getConversationPartnerId } from "@/lib/chat/access";
import { InteractionError } from "@/lib/chat/interaction-error";
import { assertReplyTarget } from "@/lib/chat/reply-target";
import { isValidTimeZone, zonedDayBounds } from "@/lib/history/timezone";
import { getMessageByClientGeneratedId, getMessageById } from "@/lib/chat/queries";
import { serializeMessage } from "@/lib/chat/serialize";
import type { ChatMessage, ChatMediaItem } from "@/lib/chat/types";
import { getDb } from "@/lib/db";
import { mediaUploads, messageMedia, messageReceipts, messages } from "@/lib/db/schema";
import { logError, logInfo } from "@/lib/logger";
import {
  audioBytesLookForged,
  isAllowedAudioMime,
  normalizeMime,
  isAllowedImageMime,
  sanitizeOriginalFilename,
  sniffImageMime,
  validateAudioUploadMeta,
  validateImageUploadMeta,
  VIDEO_PLAYBACK_URL_TTL_SECONDS,
  VOICE_PLAYBACK_URL_TTL_SECONDS,
} from "@/lib/media/validation";
import { CONSUMER_AUDIO_ERRORS, mapMediaErrorToConsumer } from "@/lib/media/consumer-errors";
import type { DerivativeMime } from "@/lib/media/encode-derivative";
import { broadcastConversationEvent } from "@/lib/realtime/broadcast";
import { mediaFolderPrefix, objectKeyForVariant } from "@/lib/storage/object-keys";
import { getStorageProvider } from "@/lib/storage";

const UPLOAD_TTL_MS = 30 * 60 * 1000;
export const SHARED_MEDIA_PAGE_SIZE = 60;
export const SHARED_MEDIA_PAGE_MAX = 100;

export type SharedMediaFavoriteFilter = "any" | "mine" | "both";
export type SharedMediaSort = "newest" | "oldest";

export type SharedMediaItem = ChatMediaItem & {
  messageId: string;
  senderId: string;
  caption: string | null;
  createdAt: string;
  /** Carried through so a later video phase can branch without a schema change. */
  mediaType: string;
  durationMs?: number | null;
  /** How many ready attachments the source chat message carries. */
  messageAttachmentCount: number;
  /** User ids that hearted this media. Two entries means "loved by both". */
  favoritedBy: string[];
};

export type SharedMediaPage = {
  items: SharedMediaItem[];
  nextCursor: string | null;
};

function normalizeFavoritedBy(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

export class MediaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaValidationError";
  }
}

async function requireReplyTarget(conversationId: string, replyToMessageId?: string) {
  if (!replyToMessageId) {
    return;
  }
  try {
    await assertReplyTarget({ conversationId, replyToMessageId });
  } catch (error) {
    if (error instanceof InteractionError) {
      throw new MediaValidationError(error.message);
    }
    throw error;
  }
}

export async function initMediaUpload(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  clientGeneratedId: string;
  clientAssetId: string;
  variant: "original" | "preview" | "thumbnail";
  filename: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  checksum?: string;
  mediaFolderId: string;
  /**
   * Chosen by the route, never by the request body, so the photo endpoint cannot be
   * talked into accepting audio bytes.
   */
  kind?: "image" | "audio";
}) {
  const validation =
    params.kind === "audio"
      ? validateAudioUploadMeta({ mimeType: params.mimeType, size: params.size })
      : validateImageUploadMeta({
          mimeType: params.mimeType,
          size: params.size,
          variant: params.variant,
        });
  if (!validation.ok) {
    throw new MediaValidationError(mapMediaErrorToConsumer(validation.message));
  }

  const db = getDb();
  const existing = await db
    .select()
    .from(mediaUploads)
    .where(
      and(
        eq(mediaUploads.uploaderId, params.userId),
        eq(mediaUploads.clientGeneratedId, params.clientGeneratedId),
        eq(mediaUploads.clientAssetId, params.clientAssetId),
        eq(mediaUploads.variant, params.variant),
      ),
    )
    .limit(1);

  const storage = getStorageProvider();
  const folder = mediaFolderPrefix(params.conversationId, params.mediaFolderId);
  const mimeType = normalizeMime(params.mimeType);
  const derivativeMime: DerivativeMime | undefined =
    params.variant === "original"
      ? undefined
      : mimeType === "image/jpeg"
        ? "image/jpeg"
        : "image/webp";
  const storageKey = objectKeyForVariant(folder, params.variant, derivativeMime);
  const expiresAt = new Date(Date.now() + UPLOAD_TTL_MS);

  let row = existing[0];
  if (row && (row.status === "uploaded" || row.status === "consumed")) {
    throw new MediaValidationError("That upload is already finished.");
  }

  if (!row) {
    const inserted = await db
      .insert(mediaUploads)
      .values({
        uploaderId: params.userId,
        conversationId: params.conversationId,
        clientGeneratedId: params.clientGeneratedId,
        clientAssetId: params.clientAssetId,
        variant: params.variant,
        storageKey,
        mimeType,
        sizeBytes: params.size,
        width: params.width,
        height: params.height,
        checksum: params.checksum,
        originalFilename: sanitizeOriginalFilename(params.filename),
        status: "pending",
        expiresAt,
      })
      .returning();
    row = inserted[0]!;
  } else {
    const updated = await db
      .update(mediaUploads)
      .set({
        storageKey,
        mimeType,
        sizeBytes: params.size,
        width: params.width,
        height: params.height,
        checksum: params.checksum,
        originalFilename: sanitizeOriginalFilename(params.filename),
        status: "pending",
        expiresAt,
        completedAt: null,
      })
      .where(eq(mediaUploads.id, row.id))
      .returning();
    row = updated[0]!;
  }

  // Browser PUTs go to a short-lived signed URL (R2 or local test shim).
  // Do not proxy bytes through Next — Vercel request bodies cannot carry 50 MB photos.
  const upload = await storage.createSignedUploadUrl({
    key: row.storageKey,
    contentType: mimeType,
    contentLength: params.size,
  });

  logInfo({
    requestId: params.requestId,
    operation: "initMediaUpload",
    userId: params.userId,
    extra: { uploadId: row.id, variant: params.variant, storage: storage.name },
  });

  return {
    uploadId: row.id,
    storageKey: row.storageKey,
    upload,
  };
}

export async function putMediaUploadContent(params: {
  requestId: string;
  userId: string;
  uploadId: string;
  body: Uint8Array;
  contentType?: string;
}) {
  const db = getDb();
  const row = (
    await db.select().from(mediaUploads).where(eq(mediaUploads.id, params.uploadId)).limit(1)
  )[0];

  if (!row || row.uploaderId !== params.userId) {
    throw new MediaValidationError("Upload not found.");
  }
  if (row.status === "aborted" || row.status === "expired") {
    throw new MediaValidationError("That upload was cancelled.");
  }
  if (row.status === "uploaded" || row.status === "consumed") {
    throw new MediaValidationError("That upload is already finished.");
  }
  if (row.expiresAt.getTime() < Date.now()) {
    await db.update(mediaUploads).set({ status: "expired" }).where(eq(mediaUploads.id, row.id));
    throw new MediaValidationError("That upload link expired. Try again.");
  }
  if (params.body.byteLength !== row.sizeBytes) {
    throw new MediaValidationError("Upload size didn’t match. Try again.");
  }
  if (params.contentType) {
    const incoming = normalizeMime(params.contentType);
    if (incoming !== row.mimeType) {
      throw new MediaValidationError("Upload type didn’t match. Try again.");
    }
  }

  const storage = getStorageProvider();
  await storage.putObject({
    key: row.storageKey,
    body: params.body,
    contentType: row.mimeType,
    contentLength: params.body.byteLength,
  });

  logInfo({
    requestId: params.requestId,
    operation: "putMediaUploadContent",
    userId: params.userId,
    extra: { uploadId: row.id, byteCount: params.body.byteLength, storage: storage.name },
  });
}

export async function completeMediaUpload(params: {
  requestId: string;
  userId: string;
  uploadId: string;
  checksum?: string;
}) {
  const db = getDb();
  const row = (
    await db.select().from(mediaUploads).where(eq(mediaUploads.id, params.uploadId)).limit(1)
  )[0];

  if (!row || row.uploaderId !== params.userId) {
    throw new MediaValidationError("Upload not found.");
  }
  if (row.status === "aborted" || row.status === "expired") {
    throw new MediaValidationError("That upload was cancelled.");
  }
  if (row.status === "uploaded" || row.status === "consumed") {
    return { uploadId: row.id, status: row.status };
  }
  if (row.expiresAt.getTime() < Date.now()) {
    await db.update(mediaUploads).set({ status: "expired" }).where(eq(mediaUploads.id, row.id));
    throw new MediaValidationError("That upload link expired. Try again.");
  }

  const storage = getStorageProvider();
  const meta = await storage.headObject(row.storageKey);
  if (!meta) {
    throw new MediaValidationError("We couldn’t find that upload yet.");
  }
  if (meta.size !== row.sizeBytes) {
    await storage.deleteObject(row.storageKey).catch(() => undefined);
    throw new MediaValidationError("Upload size didn’t match. Try again.");
  }

  if (row.variant === "original" && isAllowedImageMime(row.mimeType)) {
    const head = await storage.getObjectRange(row.storageKey, 0, 15);
    if (!head || head.byteLength < 8) {
      await storage.deleteObject(row.storageKey).catch(() => undefined);
      throw new MediaValidationError("We couldn’t find that upload yet.");
    }
    const sniffed = sniffImageMime(head);
    if (sniffed && sniffed !== row.mimeType) {
      await storage.deleteObject(row.storageKey).catch(() => undefined);
      throw new MediaValidationError("Upload type didn’t match. Try again.");
    }
  }

  await db
    .update(mediaUploads)
    .set({
      status: "uploaded",
      completedAt: new Date(),
      checksum: params.checksum ?? row.checksum,
    })
    .where(eq(mediaUploads.id, row.id));

  logInfo({
    requestId: params.requestId,
    operation: "completeMediaUpload",
    userId: params.userId,
    extra: { uploadId: row.id, byteCount: meta.size },
  });

  return { uploadId: row.id, status: "uploaded" as const };
}

export async function cancelMediaUpload(params: {
  requestId: string;
  userId: string;
  uploadId: string;
}) {
  const db = getDb();
  const row = (
    await db.select().from(mediaUploads).where(eq(mediaUploads.id, params.uploadId)).limit(1)
  )[0];
  if (!row || row.uploaderId !== params.userId) {
    throw new MediaValidationError("Upload not found.");
  }
  if (row.status === "consumed") {
    throw new MediaValidationError("That photo is already part of a message.");
  }

  const storage = getStorageProvider();
  await storage.deleteObject(row.storageKey).catch(() => undefined);
  await db
    .update(mediaUploads)
    .set({ status: "aborted", completedAt: new Date() })
    .where(eq(mediaUploads.id, row.id));

  logInfo({
    requestId: params.requestId,
    operation: "cancelMediaUpload",
    userId: params.userId,
    extra: { uploadId: row.id },
  });

  return { uploadId: row.id, status: "aborted" as const };
}

export async function finalizePhotoMessage(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  clientGeneratedId: string;
  caption?: string;
  replyToMessageId?: string;
  assets: {
    clientAssetId: string;
    sortOrder: number;
    originalUploadId: string;
    previewUploadId: string;
    thumbnailUploadId: string;
    width: number;
    height: number;
    mimeType: string;
    originalFilename: string;
    checksum?: string;
  }[];
}): Promise<ChatMessage> {
  const started = Date.now();
  const existing = await getMessageByClientGeneratedId(
    params.userId,
    params.clientGeneratedId,
    params.userId,
  );
  if (existing) {
    return existing;
  }

  const sorted = [...params.assets].sort((a, b) => a.sortOrder - b.sortOrder);
  const orders = new Set(sorted.map((a) => a.sortOrder));
  if (orders.size !== sorted.length) {
    throw new MediaValidationError("Album order must be unique.");
  }

  const uploadIds = sorted.flatMap((a) => [
    a.originalUploadId,
    a.previewUploadId,
    a.thumbnailUploadId,
  ]);
  if (new Set(uploadIds).size !== uploadIds.length) {
    throw new MediaValidationError("Duplicate upload ids.");
  }

  const db = getDb();
  const uploadRows = await db
    .select()
    .from(mediaUploads)
    .where(inArray(mediaUploads.id, uploadIds));

  if (uploadRows.length !== uploadIds.length) {
    throw new MediaValidationError("Some uploads are missing.");
  }

  const byId = new Map(uploadRows.map((row) => [row.id, row]));
  for (const asset of sorted) {
    for (const [uploadId, expectedVariant] of [
      [asset.originalUploadId, "original"],
      [asset.previewUploadId, "preview"],
      [asset.thumbnailUploadId, "thumbnail"],
    ] as const) {
      const row = byId.get(uploadId)!;
      if (row.uploaderId !== params.userId) {
        throw new MediaValidationError("Upload not found.");
      }
      if (row.conversationId !== params.conversationId) {
        throw new MediaValidationError("Upload conversation mismatch.");
      }
      if (row.clientGeneratedId !== params.clientGeneratedId) {
        throw new MediaValidationError("Upload message mismatch.");
      }
      if (row.clientAssetId !== asset.clientAssetId) {
        throw new MediaValidationError("Upload asset mismatch.");
      }
      if (row.variant !== expectedVariant) {
        throw new MediaValidationError("Upload variant mismatch.");
      }
      if (row.status !== "uploaded") {
        throw new MediaValidationError("All photos must finish uploading first.");
      }
    }
  }

  const partnerId = await getConversationPartnerId(params.conversationId, params.userId);
  const caption = params.caption?.trim() ? params.caption.trim() : null;
  await requireReplyTarget(params.conversationId, params.replyToMessageId);

  try {
    const inserted = await db.transaction(async (tx) => {
      const [messageRow] = await tx
        .insert(messages)
        .values({
          conversationId: params.conversationId,
          senderId: params.userId,
          clientGeneratedId: params.clientGeneratedId,
          type: "image",
          textContent: caption,
          replyToMessageId: params.replyToMessageId,
          metadata: { albumSize: sorted.length },
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
                eq(messages.clientGeneratedId, params.clientGeneratedId),
              ),
            )
            .limit(1)
        )[0];

      if (!message) {
        throw new Error("insert_failed");
      }

      if (messageRow) {
        for (const asset of sorted) {
          const original = byId.get(asset.originalUploadId)!;
          const preview = byId.get(asset.previewUploadId)!;
          const thumb = byId.get(asset.thumbnailUploadId)!;
          await tx.insert(messageMedia).values({
            messageId: message.id,
            uploaderId: params.userId,
            storageKey: original.storageKey,
            previewStorageKey: preview.storageKey,
            thumbnailStorageKey: thumb.storageKey,
            originalFilename: sanitizeOriginalFilename(asset.originalFilename),
            mimeType: normalizeMime(asset.mimeType),
            mediaType: "image",
            width: asset.width,
            height: asset.height,
            originalSizeBytes: original.sizeBytes,
            previewSizeBytes: preview.sizeBytes,
            checksum: asset.checksum ?? original.checksum,
            uploadStatus: "ready",
            sortOrder: asset.sortOrder,
          });
        }

        await tx
          .update(mediaUploads)
          .set({ status: "consumed" })
          .where(inArray(mediaUploads.id, uploadIds));

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
      operation: "finalizePhotoMessage",
      userId: params.userId,
      durationMs: Date.now() - started,
      extra: { albumSize: sorted.length },
    });

    void broadcastConversationEvent(params.conversationId, "message:new", {
      messageId: serialized.id,
    });
    // Separate event so the media library converges without listening to chat.
    void broadcastConversationEvent(params.conversationId, "media:changed", {
      messageId: serialized.id,
    });

    // Soft orphan sweep — only expired pending uploads; never delete-all.
    void cleanupExpiredUploads(25).catch(() => undefined);

    return serialized;
  } catch (error) {
    logError({
      requestId: params.requestId,
      operation: "finalizePhotoMessage",
      userId: params.userId,
      errorClass: error instanceof Error ? error.name : "unknown",
      durationMs: Date.now() - started,
    });
    throw error;
  }
}

function voiceUploadFilename(mimeType: string): string {
  const mime = normalizeMime(mimeType);
  const ext =
    mime === "audio/mp4"
      ? "m4a"
      : mime === "audio/ogg"
        ? "ogg"
        : mime === "audio/aac"
          ? "aac"
          : "webm";
  return `Voice message.${ext}`;
}

/**
 * Voice reuses the photo upload row and the same-origin proxy PUT — a voice note is a
 * few hundred kilobytes, so the multipart video machinery would buy nothing.
 * The object key is the usual unpredictable `.../original`, with no hint of audio.
 */
export async function initVoiceUpload(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  clientGeneratedId: string;
  clientAssetId: string;
  mediaFolderId: string;
  mimeType: string;
  size: number;
}) {
  const db = getDb();
  const existing = (
    await db
      .select()
      .from(mediaUploads)
      .where(
        and(
          eq(mediaUploads.uploaderId, params.userId),
          eq(mediaUploads.clientGeneratedId, params.clientGeneratedId),
          eq(mediaUploads.clientAssetId, params.clientAssetId),
          eq(mediaUploads.variant, "original"),
        ),
      )
      .limit(1)
  )[0];

  // The bytes from an earlier attempt already landed: a retry should finalize,
  // not re-send the recording.
  if (existing && (existing.status === "uploaded" || existing.status === "consumed")) {
    return { uploadId: existing.id, storageKey: existing.storageKey, upload: null };
  }

  const initialized = await initMediaUpload({
    ...params,
    variant: "original",
    filename: voiceUploadFilename(params.mimeType),
    kind: "audio",
  });
  return { ...initialized, upload: initialized.upload as typeof initialized.upload | null };
}

/**
 * Turn a finished voice upload into a message.
 *
 * Idempotent on `(senderId, clientGeneratedId)` so a retry after a dropped response
 * cannot produce two voice notes. Only `message:new` is broadcast — voice deliberately
 * never reaches the shared media library, so `media:changed` would be a lie.
 */
export async function finalizeVoiceMessage(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  clientGeneratedId: string;
  uploadId: string;
  durationMs: number;
  waveform: number[];
  replyToMessageId?: string;
}): Promise<ChatMessage> {
  const started = Date.now();
  const existing = await getMessageByClientGeneratedId(
    params.userId,
    params.clientGeneratedId,
    params.userId,
  );
  if (existing) {
    return existing;
  }

  const db = getDb();
  const upload = (
    await db.select().from(mediaUploads).where(eq(mediaUploads.id, params.uploadId)).limit(1)
  )[0];

  if (!upload || upload.uploaderId !== params.userId) {
    throw new MediaValidationError("Upload not found.");
  }
  if (upload.conversationId !== params.conversationId) {
    throw new MediaValidationError("Upload conversation mismatch.");
  }
  if (upload.clientGeneratedId !== params.clientGeneratedId) {
    throw new MediaValidationError("Upload message mismatch.");
  }
  if (upload.variant !== "original") {
    throw new MediaValidationError("Upload variant mismatch.");
  }
  if (upload.status !== "uploaded") {
    throw new MediaValidationError("The voice message is still uploading.");
  }
  if (!isAllowedAudioMime(upload.mimeType)) {
    throw new MediaValidationError("That audio format isn't supported yet.");
  }

  // The declared type is never trusted: sniff the container that actually landed.
  // A missing object is not an "unknown engine" — refuse rather than skip the sniff.
  const storage = getStorageProvider();
  const head = await storage.getObjectRange(upload.storageKey, 0, 15);
  if (!head || head.byteLength < 12 || audioBytesLookForged(upload.mimeType, head)) {
    await storage.deleteObject(upload.storageKey).catch(() => undefined);
    await db.update(mediaUploads).set({ status: "aborted" }).where(eq(mediaUploads.id, upload.id));
    throw new MediaValidationError(
      !head || head.byteLength < 12
        ? CONSUMER_AUDIO_ERRORS.GONE
        : "That audio format isn't supported yet.",
    );
  }

  const partnerId = await getConversationPartnerId(params.conversationId, params.userId);
  await requireReplyTarget(params.conversationId, params.replyToMessageId);

  try {
    const inserted = await db.transaction(async (tx) => {
      const [messageRow] = await tx
        .insert(messages)
        .values({
          conversationId: params.conversationId,
          senderId: params.userId,
          clientGeneratedId: params.clientGeneratedId,
          type: "audio",
          textContent: null,
          replyToMessageId: params.replyToMessageId,
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
                eq(messages.clientGeneratedId, params.clientGeneratedId),
              ),
            )
            .limit(1)
        )[0];

      if (!message) {
        throw new Error("insert_failed");
      }

      if (messageRow) {
        await tx.insert(messageMedia).values({
          messageId: message.id,
          uploaderId: params.userId,
          storageKey: upload.storageKey,
          originalFilename: upload.originalFilename,
          mimeType: normalizeMime(upload.mimeType),
          mediaType: "audio",
          durationMs: params.durationMs,
          originalSizeBytes: upload.sizeBytes,
          waveformSamples: params.waveform,
          uploadStatus: "ready",
          sortOrder: 0,
        });

        await tx
          .update(mediaUploads)
          .set({ status: "consumed" })
          .where(eq(mediaUploads.id, upload.id));

        if (partnerId) {
          await tx
            .insert(messageReceipts)
            .values({ messageId: message.id, userId: partnerId })
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
      operation: "finalizeVoiceMessage",
      userId: params.userId,
      durationMs: Date.now() - started,
      extra: { clipMs: params.durationMs, byteCount: upload.sizeBytes },
    });

    void broadcastConversationEvent(params.conversationId, "message:new", {
      messageId: serialized.id,
    });

    void cleanupExpiredUploads(25).catch(() => undefined);

    return serialized;
  } catch (error) {
    logError({
      requestId: params.requestId,
      operation: "finalizeVoiceMessage",
      userId: params.userId,
      errorClass: error instanceof Error ? error.name : "unknown",
      durationMs: Date.now() - started,
    });
    throw error;
  }
}

export async function loadMediaForMessages(
  messageIds: string[],
): Promise<Map<string, ChatMediaItem[]>> {
  const map = new Map<string, ChatMediaItem[]>();
  if (messageIds.length === 0) return map;
  const db = getDb();
  const rows = await db
    .select()
    .from(messageMedia)
    .where(and(inArray(messageMedia.messageId, messageIds), eq(messageMedia.uploadStatus, "ready")))
    .orderBy(asc(messageMedia.sortOrder));

  for (const row of rows) {
    const list = map.get(row.messageId) ?? [];
    list.push({
      id: row.id,
      sortOrder: row.sortOrder,
      mimeType: row.mimeType,
      mediaType:
        row.mediaType === "video" ? "video" : row.mediaType === "audio" ? "audio" : "image",
      width: row.width,
      height: row.height,
      durationMs: row.durationMs == null ? null : Number(row.durationMs),
      originalSizeBytes: row.originalSizeBytes,
      previewSizeBytes: row.previewSizeBytes,
      originalFilename: row.originalFilename,
      uploadStatus: row.uploadStatus,
      hasPreview: Boolean(row.previewStorageKey),
      hasThumbnail: Boolean(row.thumbnailStorageKey),
      waveform: row.waveformSamples ?? undefined,
    });
    map.set(row.messageId, list);
  }
  return map;
}

function encodeSharedMediaCursor(createdAt: Date, id: string) {
  return `${createdAt.toISOString()}|${id}`;
}

function decodeSharedMediaCursor(cursor: string): { createdAt: Date; id: string } | null {
  const sep = cursor.indexOf("|");
  if (sep <= 0) return null;
  const createdAt = new Date(cursor.slice(0, sep));
  const id = cursor.slice(sep + 1);
  if (Number.isNaN(createdAt.getTime()) || !id) return null;
  return { createdAt, id };
}

/** Attachment count + per-person hearts resolved in the same scan — no N+1. */
const messageAttachmentCountExpr = sql<number>`(
  select count(*)::int from message_media mm2
  where mm2.message_id = ${messageMedia.messageId}
    and mm2.upload_status = 'ready'
)`;

const favoritedByExpr = sql<string[]>`(
  select coalesce(array_agg(mf.user_id::text order by mf.created_at), '{}')
  from media_favorites mf
  where mf.media_id = ${messageMedia.id}
)`;

/**
 * Conversation shared-media library: finalized ready media only.
 * Includes every album attachment; never pending/failed/cancelled uploads.
 * `mediaType` filters All / Photos / Videos. Finalized ready media only.
 */
export async function listSharedConversationMedia(params: {
  requestId: string;
  conversationId: string;
  userId: string;
  cursor?: string;
  limit?: number;
  senderId?: string;
  /** Local calendar bounds, resolved with the caller's timezone. */
  from?: string;
  to?: string;
  timeZone?: string;
  favorites?: SharedMediaFavoriteFilter;
  sort?: SharedMediaSort;
  mediaType?: "image" | "video" | "all";
}): Promise<SharedMediaPage> {
  const limit = Math.min(
    Math.max(params.limit ?? SHARED_MEDIA_PAGE_SIZE, 1),
    SHARED_MEDIA_PAGE_MAX,
  );
  const db = getDb();
  const cursor = params.cursor ? decodeSharedMediaCursor(params.cursor) : null;
  const sort: SharedMediaSort = params.sort === "oldest" ? "oldest" : "newest";
  const ascending = sort === "oldest";
  const timeZone = params.timeZone && isValidTimeZone(params.timeZone) ? params.timeZone : "UTC";

  const rangeStart = params.from ? zonedDayBounds(params.from, timeZone).start : null;
  const rangeEnd = params.to ? zonedDayBounds(params.to, timeZone).nextStart : null;

  const favoriteFilter =
    params.favorites === "mine"
      ? sql`exists (
          select 1 from media_favorites mf
          where mf.media_id = ${messageMedia.id} and mf.user_id = ${params.userId}
        )`
      : params.favorites === "both"
        ? sql`(
            select count(*) from media_favorites mf where mf.media_id = ${messageMedia.id}
          ) >= 2`
        : undefined;

  const cursorFilter = cursor
    ? ascending
      ? or(
          gt(messageMedia.createdAt, cursor.createdAt),
          and(eq(messageMedia.createdAt, cursor.createdAt), gt(messageMedia.id, cursor.id)),
        )
      : or(
          lt(messageMedia.createdAt, cursor.createdAt),
          and(eq(messageMedia.createdAt, cursor.createdAt), lt(messageMedia.id, cursor.id)),
        )
    : undefined;

  const mediaFilter =
    params.mediaType === "video"
      ? and(eq(messages.type, "video"), eq(messageMedia.mediaType, "video"))
      : params.mediaType === "image"
        ? and(eq(messages.type, "image"), eq(messageMedia.mediaType, "image"))
        : and(
            inArray(messages.type, ["image", "video"]),
            inArray(messageMedia.mediaType, ["image", "video"]),
          );

  const rows = await db
    .select({
      media: messageMedia,
      messageId: messages.id,
      senderId: messages.senderId,
      caption: messages.textContent,
      messageAttachmentCount: messageAttachmentCountExpr,
      favoritedBy: favoritedByExpr,
    })
    .from(messageMedia)
    .innerJoin(messages, eq(messageMedia.messageId, messages.id))
    .where(
      and(
        eq(messages.conversationId, params.conversationId),
        mediaFilter,
        eq(messageMedia.uploadStatus, "ready"),
        params.senderId ? eq(messages.senderId, params.senderId) : undefined,
        rangeStart ? gte(messageMedia.createdAt, rangeStart) : undefined,
        rangeEnd ? lt(messageMedia.createdAt, rangeEnd) : undefined,
        favoriteFilter,
        cursorFilter,
      ),
    )
    .orderBy(
      ascending ? asc(messageMedia.createdAt) : desc(messageMedia.createdAt),
      ascending ? asc(messageMedia.id) : desc(messageMedia.id),
    )
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const items: SharedMediaItem[] = page.map((row) => ({
    id: row.media.id,
    messageId: row.messageId,
    sortOrder: row.media.sortOrder,
    mimeType: row.media.mimeType,
    mediaType: row.media.mediaType === "video" ? "video" : "image",
    width: row.media.width,
    height: row.media.height,
    durationMs: row.media.durationMs,
    originalSizeBytes: row.media.originalSizeBytes,
    previewSizeBytes: row.media.previewSizeBytes,
    originalFilename: row.media.originalFilename,
    uploadStatus: row.media.uploadStatus,
    hasPreview: Boolean(row.media.previewStorageKey),
    hasThumbnail: Boolean(row.media.thumbnailStorageKey),
    senderId: row.senderId,
    caption: row.caption,
    createdAt: row.media.createdAt.toISOString(),
    messageAttachmentCount: Number(row.messageAttachmentCount) || 1,
    favoritedBy: normalizeFavoritedBy(row.favoritedBy),
  }));

  const last = page[page.length - 1];
  const nextCursor =
    rows.length > limit && last
      ? encodeSharedMediaCursor(last.media.createdAt, last.media.id)
      : null;

  logInfo({
    requestId: params.requestId,
    operation: "listSharedConversationMedia",
    userId: params.userId,
    extra: { count: items.length, hasMore: Boolean(nextCursor), sort },
  });

  return { items, nextCursor };
}

/** Ready album attachments for one finalized image message (viewer navigation). */
export async function listReadyMediaForMessage(params: {
  conversationId: string;
  messageId: string;
}): Promise<ChatMediaItem[]> {
  const db = getDb();
  const message = (
    await db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.id, params.messageId),
          eq(messages.conversationId, params.conversationId),
          inArray(messages.type, ["image", "video"]),
        ),
      )
      .limit(1)
  )[0];
  if (!message) return [];
  const map = await loadMediaForMessages([message.id]);
  return map.get(message.id) ?? [];
}

export async function getAuthorizedMediaRow(params: {
  mediaId: string;
  userId: string;
  conversationId: string;
}) {
  const db = getDb();
  const row = (
    await db
      .select({
        media: messageMedia,
        message: messages,
      })
      .from(messageMedia)
      .innerJoin(messages, eq(messageMedia.messageId, messages.id))
      .where(eq(messageMedia.id, params.mediaId))
      .limit(1)
  )[0];

  if (!row) return null;
  if (row.message.conversationId !== params.conversationId) return null;
  // Defense in depth: routes derive the conversation from the session, but the
  // service must not grant access on a caller-supplied id alone.
  if (!(await authorizeConversationAccess(params.userId, params.conversationId))) return null;
  return row;
}

export async function createMediaReadUrl(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  mediaId: string;
  variant: "thumb" | "preview" | "original";
  download?: boolean;
}) {
  const row = await getAuthorizedMediaRow({
    mediaId: params.mediaId,
    userId: params.userId,
    conversationId: params.conversationId,
  });
  if (!row) {
    throw new MediaValidationError("Couldn't find that.");
  }

  const storage = getStorageProvider();
  const key =
    params.variant === "original"
      ? row.media.storageKey
      : params.variant === "preview"
        ? row.media.previewStorageKey
        : row.media.thumbnailStorageKey;

  if (!key) {
    throw new MediaValidationError(
      params.variant === "original" ? "Original unavailable." : "Preview unavailable.",
    );
  }

  const isOriginal = params.variant === "original";
  const isVideoOriginal = row.media.mediaType === "video" && isOriginal;
  const isAudioOriginal = row.media.mediaType === "audio" && isOriginal;
  const signed = await storage.createSignedDownloadUrl({
    key,
    expiresInSeconds: isVideoOriginal
      ? VIDEO_PLAYBACK_URL_TTL_SECONDS
      : isAudioOriginal
        ? VOICE_PLAYBACK_URL_TTL_SECONDS
        : undefined,
    downloadFilename:
      params.download && isOriginal
        ? sanitizeOriginalFilename(
            row.media.originalFilename ??
              (isVideoOriginal ? "video" : isAudioOriginal ? "Voice message" : "photo"),
          )
        : undefined,
  });

  logInfo({
    requestId: params.requestId,
    operation: "createMediaReadUrl",
    userId: params.userId,
    extra: { mediaId: params.mediaId, variant: params.variant },
  });

  return {
    url: signed.url,
    expiresAt: signed.expiresAt,
    variant: params.variant,
    mediaId: params.mediaId,
  };
}

/** Authenticated byte fetch for Save photo (same-origin; no R2 CORS). */
export async function getAuthorizedMediaBytes(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  mediaId: string;
  variant: "thumb" | "preview" | "original";
}) {
  const row = await getAuthorizedMediaRow({
    mediaId: params.mediaId,
    userId: params.userId,
    conversationId: params.conversationId,
  });
  if (!row) {
    throw new MediaValidationError("Couldn't find that.");
  }

  const key =
    params.variant === "original"
      ? row.media.storageKey
      : params.variant === "preview"
        ? row.media.previewStorageKey
        : row.media.thumbnailStorageKey;

  if (!key) {
    throw new MediaValidationError(
      params.variant === "original" ? "Original unavailable." : "Preview unavailable.",
    );
  }

  const storage = getStorageProvider();
  const kind =
    row.media.mediaType === "video"
      ? "video"
      : row.media.mediaType === "audio"
        ? "voice message"
        : "photo";
  if (!storage.getObjectBytes) {
    throw new MediaValidationError(`Couldn't prepare this ${kind}.`);
  }
  const bytes = await storage.getObjectBytes(key);
  if (!bytes) {
    throw new MediaValidationError(`Couldn't load this ${kind}.`);
  }

  logInfo({
    requestId: params.requestId,
    operation: "getAuthorizedMediaBytes",
    userId: params.userId,
    extra: { mediaId: params.mediaId, variant: params.variant, byteCount: bytes.byteLength },
  });

  return {
    bytes,
    contentType: row.media.mimeType || "application/octet-stream",
    filename: sanitizeOriginalFilename(
      row.media.originalFilename ??
        (row.media.mediaType === "video"
          ? "video.mp4"
          : row.media.mediaType === "audio"
            ? "Voice message.m4a"
            : "photo.jpg"),
    ),
  };
}

/** Soft orphan cleanup helper — delete expired pending uploads + objects. */
export async function cleanupExpiredUploads(limit = 50) {
  const db = getDb();
  const storage = getStorageProvider();
  const rows = await db
    .select()
    .from(mediaUploads)
    .where(and(eq(mediaUploads.status, "pending")))
    .limit(limit);

  let cleaned = 0;
  for (const row of rows) {
    if (row.expiresAt.getTime() >= Date.now()) continue;
    await storage.deleteObject(row.storageKey).catch(() => undefined);
    await db.update(mediaUploads).set({ status: "expired" }).where(eq(mediaUploads.id, row.id));
    cleaned += 1;
  }
  return cleaned;
}

export function newMediaFolderId() {
  return randomUUID();
}
