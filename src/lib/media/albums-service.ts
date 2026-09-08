import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { authorizeConversationAccess } from "@/lib/chat/access";
import { getDb } from "@/lib/db";
import { messageMedia, messages, sharedAlbumItems, sharedAlbums } from "@/lib/db/schema";
import { logInfo } from "@/lib/logger";
import { MediaValidationError } from "@/lib/media/service";
import type { SharedMediaItem } from "@/lib/media/service";

export const ALBUM_TITLE_MAX = 80;
export const ALBUM_NOTE_MAX = 500;
export const ALBUM_ITEMS_BATCH_MAX = 50;

export type AlbumSummary = {
  id: string;
  title: string;
  note: string | null;
  itemCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** Resolved cover: explicit choice, else first item. Null only when empty. */
  cover: AlbumCover | null;
};

export type AlbumCover = {
  mediaId: string;
  hasPreview: boolean;
  hasThumbnail: boolean;
  width: number | null;
  height: number | null;
  mediaType: "image" | "video";
};

export type AlbumDetail = AlbumSummary & {
  coverMediaId: string | null;
  items: SharedMediaItem[];
};

/**
 * Every album entry point re-checks membership rather than trusting the
 * conversation id it was handed, so no id can reach across conversations.
 */
async function assertMember(conversationId: string, userId: string) {
  if (!(await authorizeConversationAccess(userId, conversationId))) {
    throw new MediaValidationError("That album isn't available.");
  }
}

/** Album rows are conversation-scoped; both participants read and write. */
async function requireAlbum(albumId: string, conversationId: string, userId: string) {
  await assertMember(conversationId, userId);
  const db = getDb();
  const row = (
    await db
      .select()
      .from(sharedAlbums)
      .where(and(eq(sharedAlbums.id, albumId), eq(sharedAlbums.conversationId, conversationId)))
      .limit(1)
  )[0];
  if (!row) {
    throw new MediaValidationError("That album isn't available.");
  }
  return row;
}

/**
 * Only media finalized inside this conversation may join an album.
 * Returns the ids in the caller's requested order, deduped.
 */
async function resolveConversationMediaIds(
  mediaIds: string[],
  conversationId: string,
): Promise<string[]> {
  const unique = [...new Set(mediaIds)];
  if (unique.length === 0) return [];
  if (unique.length > ALBUM_ITEMS_BATCH_MAX) {
    throw new MediaValidationError("That's too many items at once.");
  }

  const db = getDb();
  const rows = await db
    .select({ id: messageMedia.id })
    .from(messageMedia)
    .innerJoin(messages, eq(messageMedia.messageId, messages.id))
    .where(
      and(
        inArray(messageMedia.id, unique),
        eq(messages.conversationId, conversationId),
        eq(messageMedia.uploadStatus, "ready"),
        // Albums are a visual surface; voice notes are not album material.
        inArray(messageMedia.mediaType, ["image", "video"]),
      ),
    );

  const allowed = new Set(rows.map((row) => row.id));
  const resolved = unique.filter((id) => allowed.has(id));
  if (resolved.length !== unique.length) {
    throw new MediaValidationError("Some of those aren't available.");
  }
  return resolved;
}

const itemCountExpr = sql<number>`(
  select count(*)::int from shared_album_items sai where sai.album_id = ${sharedAlbums.id}
)`;

/** Explicit cover, else the first positioned item, resolved without an extra round trip. */
const resolvedCoverIdExpr = sql<string | null>`coalesce(
  ${sharedAlbums.coverMediaId},
  (select sai.media_id from shared_album_items sai
    where sai.album_id = ${sharedAlbums.id}
    order by sai.position asc, sai.added_at asc
    limit 1)
)`;

async function loadCovers(mediaIds: string[]): Promise<Map<string, AlbumCover>> {
  const map = new Map<string, AlbumCover>();
  const unique = [...new Set(mediaIds)];
  if (unique.length === 0) return map;
  const db = getDb();
  const rows = await db
    .select({
      id: messageMedia.id,
      previewStorageKey: messageMedia.previewStorageKey,
      thumbnailStorageKey: messageMedia.thumbnailStorageKey,
      width: messageMedia.width,
      height: messageMedia.height,
      mediaType: messageMedia.mediaType,
    })
    .from(messageMedia)
    .where(inArray(messageMedia.id, unique));
  for (const row of rows) {
    map.set(row.id, {
      mediaId: row.id,
      hasPreview: Boolean(row.previewStorageKey),
      hasThumbnail: Boolean(row.thumbnailStorageKey),
      width: row.width,
      height: row.height,
      mediaType: row.mediaType === "video" ? "video" : "image",
    });
  }
  return map;
}

export async function listSharedAlbums(params: {
  requestId: string;
  conversationId: string;
  userId: string;
}): Promise<AlbumSummary[]> {
  await assertMember(params.conversationId, params.userId);
  const db = getDb();
  const rows = await db
    .select({
      album: sharedAlbums,
      itemCount: itemCountExpr,
      coverMediaId: resolvedCoverIdExpr,
    })
    .from(sharedAlbums)
    .where(eq(sharedAlbums.conversationId, params.conversationId))
    .orderBy(desc(sharedAlbums.updatedAt), desc(sharedAlbums.id));

  const covers = await loadCovers(
    rows.map((row) => row.coverMediaId).filter((id): id is string => Boolean(id)),
  );

  logInfo({
    requestId: params.requestId,
    operation: "listSharedAlbums",
    userId: params.userId,
    extra: { count: rows.length },
  });

  return rows.map((row) => ({
    id: row.album.id,
    title: row.album.title,
    note: row.album.note,
    itemCount: Number(row.itemCount) || 0,
    createdBy: row.album.createdBy,
    createdAt: row.album.createdAt.toISOString(),
    updatedAt: row.album.updatedAt.toISOString(),
    cover: row.coverMediaId ? (covers.get(row.coverMediaId) ?? null) : null,
  }));
}

export async function getSharedAlbum(params: {
  requestId: string;
  conversationId: string;
  userId: string;
  albumId: string;
}): Promise<AlbumDetail> {
  const album = await requireAlbum(params.albumId, params.conversationId, params.userId);
  const db = getDb();

  const favoritedByExpr = sql<string[]>`(
    select coalesce(array_agg(mf.user_id::text order by mf.created_at), '{}')
    from media_favorites mf where mf.media_id = ${messageMedia.id}
  )`;
  const attachmentCountExpr = sql<number>`(
    select count(*)::int from message_media mm2
    where mm2.message_id = ${messageMedia.messageId} and mm2.upload_status = 'ready'
  )`;

  const rows = await db
    .select({
      media: messageMedia,
      position: sharedAlbumItems.position,
      addedAt: sharedAlbumItems.addedAt,
      messageId: messages.id,
      senderId: messages.senderId,
      caption: messages.textContent,
      favoritedBy: favoritedByExpr,
      messageAttachmentCount: attachmentCountExpr,
    })
    .from(sharedAlbumItems)
    .innerJoin(messageMedia, eq(sharedAlbumItems.mediaId, messageMedia.id))
    .innerJoin(messages, eq(messageMedia.messageId, messages.id))
    .where(eq(sharedAlbumItems.albumId, album.id))
    .orderBy(asc(sharedAlbumItems.position), asc(sharedAlbumItems.addedAt));

  const items: SharedMediaItem[] = rows.map((row) => ({
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
    favoritedBy: Array.isArray(row.favoritedBy)
      ? row.favoritedBy.filter((id): id is string => typeof id === "string")
      : [],
  }));

  const coverId =
    album.coverMediaId && items.some((item) => item.id === album.coverMediaId)
      ? album.coverMediaId
      : (items[0]?.id ?? null);
  const coverItem = coverId ? items.find((item) => item.id === coverId) : undefined;

  return {
    id: album.id,
    title: album.title,
    note: album.note,
    itemCount: items.length,
    createdBy: album.createdBy,
    createdAt: album.createdAt.toISOString(),
    updatedAt: album.updatedAt.toISOString(),
    coverMediaId: album.coverMediaId,
    cover: coverItem
      ? {
          mediaId: coverItem.id,
          hasPreview: coverItem.hasPreview,
          hasThumbnail: coverItem.hasThumbnail,
          width: coverItem.width,
          height: coverItem.height,
          mediaType: coverItem.mediaType === "video" ? "video" : "image",
        }
      : null,
    items,
  };
}

export async function createSharedAlbum(params: {
  requestId: string;
  conversationId: string;
  userId: string;
  title: string;
  note?: string | null;
  mediaIds?: string[];
}): Promise<AlbumDetail> {
  await assertMember(params.conversationId, params.userId);
  const title = params.title.trim();
  if (!title) throw new MediaValidationError("Give the album a name.");
  if (title.length > ALBUM_TITLE_MAX) throw new MediaValidationError("That name is a bit long.");
  const note = params.note?.trim() ? params.note.trim() : null;
  if (note && note.length > ALBUM_NOTE_MAX) {
    throw new MediaValidationError("That note is a bit long.");
  }

  const mediaIds = await resolveConversationMediaIds(params.mediaIds ?? [], params.conversationId);

  const db = getDb();
  const album = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(sharedAlbums)
      .values({
        conversationId: params.conversationId,
        title,
        note,
        createdBy: params.userId,
        coverMediaId: mediaIds[0] ?? null,
      })
      .returning();
    if (!created) throw new Error("album_insert_failed");

    if (mediaIds.length > 0) {
      await tx.insert(sharedAlbumItems).values(
        mediaIds.map((mediaId, index) => ({
          albumId: created.id,
          mediaId,
          position: index,
          addedBy: params.userId,
        })),
      );
    }
    return created;
  });

  logInfo({
    requestId: params.requestId,
    operation: "createSharedAlbum",
    userId: params.userId,
    extra: { albumId: album.id, itemCount: mediaIds.length },
  });

  return getSharedAlbum({
    requestId: params.requestId,
    conversationId: params.conversationId,
    userId: params.userId,
    albumId: album.id,
  });
}

export async function updateSharedAlbum(params: {
  requestId: string;
  conversationId: string;
  userId: string;
  albumId: string;
  title?: string;
  note?: string | null;
  coverMediaId?: string | null;
}): Promise<AlbumDetail> {
  const album = await requireAlbum(params.albumId, params.conversationId, params.userId);
  const db = getDb();

  const patch: Partial<typeof sharedAlbums.$inferInsert> = { updatedAt: new Date() };

  if (params.title !== undefined) {
    const title = params.title.trim();
    if (!title) throw new MediaValidationError("Give the album a name.");
    if (title.length > ALBUM_TITLE_MAX) throw new MediaValidationError("That name is a bit long.");
    patch.title = title;
  }

  if (params.note !== undefined) {
    const note = params.note?.trim() ? params.note.trim() : null;
    if (note && note.length > ALBUM_NOTE_MAX) {
      throw new MediaValidationError("That note is a bit long.");
    }
    patch.note = note;
  }

  if (params.coverMediaId !== undefined) {
    if (params.coverMediaId === null) {
      patch.coverMediaId = null;
    } else {
      // A cover must already belong to this album.
      const member = (
        await db
          .select({ mediaId: sharedAlbumItems.mediaId })
          .from(sharedAlbumItems)
          .where(
            and(
              eq(sharedAlbumItems.albumId, album.id),
              eq(sharedAlbumItems.mediaId, params.coverMediaId),
            ),
          )
          .limit(1)
      )[0];
      if (!member) throw new MediaValidationError("Choose a cover from this album.");
      patch.coverMediaId = params.coverMediaId;
    }
  }

  await db.update(sharedAlbums).set(patch).where(eq(sharedAlbums.id, album.id));

  logInfo({
    requestId: params.requestId,
    operation: "updateSharedAlbum",
    userId: params.userId,
    extra: { albumId: album.id },
  });

  return getSharedAlbum({
    requestId: params.requestId,
    conversationId: params.conversationId,
    userId: params.userId,
    albumId: album.id,
  });
}

/** Removes the album and its memberships only. Chat messages and media are untouched. */
export async function deleteSharedAlbum(params: {
  requestId: string;
  conversationId: string;
  userId: string;
  albumId: string;
}): Promise<{ albumId: string }> {
  const album = await requireAlbum(params.albumId, params.conversationId, params.userId);
  const db = getDb();
  await db.delete(sharedAlbums).where(eq(sharedAlbums.id, album.id));

  logInfo({
    requestId: params.requestId,
    operation: "deleteSharedAlbum",
    userId: params.userId,
    extra: { albumId: album.id },
  });

  return { albumId: album.id };
}

export async function addAlbumItems(params: {
  requestId: string;
  conversationId: string;
  userId: string;
  albumId: string;
  mediaIds: string[];
}): Promise<AlbumDetail> {
  const album = await requireAlbum(params.albumId, params.conversationId, params.userId);
  const mediaIds = await resolveConversationMediaIds(params.mediaIds, params.conversationId);
  if (mediaIds.length === 0) {
    throw new MediaValidationError("Choose at least one photo or video.");
  }

  const db = getDb();
  await db.transaction(async (tx) => {
    const [{ maxPosition }] = await tx
      .select({ maxPosition: sql<number>`coalesce(max(${sharedAlbumItems.position}), -1)` })
      .from(sharedAlbumItems)
      .where(eq(sharedAlbumItems.albumId, album.id));

    let next = Number(maxPosition ?? -1);
    await tx
      .insert(sharedAlbumItems)
      .values(
        mediaIds.map((mediaId) => ({
          albumId: album.id,
          mediaId,
          position: (next += 1),
          addedBy: params.userId,
        })),
      )
      // Re-adding an existing item is a no-op, so double taps cannot duplicate.
      .onConflictDoNothing({
        target: [sharedAlbumItems.albumId, sharedAlbumItems.mediaId],
      });

    await tx
      .update(sharedAlbums)
      .set({
        updatedAt: new Date(),
        coverMediaId: album.coverMediaId ?? mediaIds[0] ?? null,
      })
      .where(eq(sharedAlbums.id, album.id));
  });

  logInfo({
    requestId: params.requestId,
    operation: "addAlbumItems",
    userId: params.userId,
    extra: { albumId: album.id, requested: mediaIds.length },
  });

  return getSharedAlbum({
    requestId: params.requestId,
    conversationId: params.conversationId,
    userId: params.userId,
    albumId: album.id,
  });
}

export async function removeAlbumItems(params: {
  requestId: string;
  conversationId: string;
  userId: string;
  albumId: string;
  mediaIds: string[];
}): Promise<AlbumDetail> {
  const album = await requireAlbum(params.albumId, params.conversationId, params.userId);
  const mediaIds = [...new Set(params.mediaIds)];
  if (mediaIds.length === 0) throw new MediaValidationError("Choose at least one photo or video.");
  if (mediaIds.length > ALBUM_ITEMS_BATCH_MAX) {
    throw new MediaValidationError("That's too many items at once.");
  }

  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .delete(sharedAlbumItems)
      .where(
        and(eq(sharedAlbumItems.albumId, album.id), inArray(sharedAlbumItems.mediaId, mediaIds)),
      );

    // Re-point the cover instead of leaving the album looking broken.
    const coverRemoved = album.coverMediaId && mediaIds.includes(album.coverMediaId);
    const nextCover = coverRemoved
      ? ((
          await tx
            .select({ mediaId: sharedAlbumItems.mediaId })
            .from(sharedAlbumItems)
            .where(eq(sharedAlbumItems.albumId, album.id))
            .orderBy(asc(sharedAlbumItems.position), asc(sharedAlbumItems.addedAt))
            .limit(1)
        )[0]?.mediaId ?? null)
      : album.coverMediaId;

    await tx
      .update(sharedAlbums)
      .set({ updatedAt: new Date(), coverMediaId: nextCover })
      .where(eq(sharedAlbums.id, album.id));
  });

  logInfo({
    requestId: params.requestId,
    operation: "removeAlbumItems",
    userId: params.userId,
    extra: { albumId: album.id, removed: mediaIds.length },
  });

  return getSharedAlbum({
    requestId: params.requestId,
    conversationId: params.conversationId,
    userId: params.userId,
    albumId: album.id,
  });
}

export async function reorderAlbumItems(params: {
  requestId: string;
  conversationId: string;
  userId: string;
  albumId: string;
  /** Full ordered list of the album's media ids. */
  mediaIds: string[];
}): Promise<AlbumDetail> {
  const album = await requireAlbum(params.albumId, params.conversationId, params.userId);
  const ordered = [...new Set(params.mediaIds)];
  const db = getDb();

  const existing = await db
    .select({ mediaId: sharedAlbumItems.mediaId })
    .from(sharedAlbumItems)
    .where(eq(sharedAlbumItems.albumId, album.id));
  const existingIds = new Set(existing.map((row) => row.mediaId));

  if (ordered.length !== existingIds.size || ordered.some((id) => !existingIds.has(id))) {
    throw new MediaValidationError("That order is out of date. Try again.");
  }

  await db.transaction(async (tx) => {
    for (const [index, mediaId] of ordered.entries()) {
      await tx
        .update(sharedAlbumItems)
        .set({ position: index })
        .where(and(eq(sharedAlbumItems.albumId, album.id), eq(sharedAlbumItems.mediaId, mediaId)));
    }
    await tx
      .update(sharedAlbums)
      .set({ updatedAt: new Date() })
      .where(eq(sharedAlbums.id, album.id));
  });

  logInfo({
    requestId: params.requestId,
    operation: "reorderAlbumItems",
    userId: params.userId,
    extra: { albumId: album.id, count: ordered.length },
  });

  return getSharedAlbum({
    requestId: params.requestId,
    conversationId: params.conversationId,
    userId: params.userId,
    albumId: album.id,
  });
}

/** Album ids a given media item already belongs to (drives "Add to album" state). */
export async function listAlbumIdsForMedia(params: {
  conversationId: string;
  mediaId: string;
}): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ albumId: sharedAlbumItems.albumId })
    .from(sharedAlbumItems)
    .innerJoin(sharedAlbums, eq(sharedAlbumItems.albumId, sharedAlbums.id))
    .where(
      and(
        eq(sharedAlbumItems.mediaId, params.mediaId),
        eq(sharedAlbums.conversationId, params.conversationId),
      ),
    );
  return rows.map((row) => row.albumId);
}
