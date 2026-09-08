import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { authorizeConversationAccess, getConversationPartnerId } from "@/lib/chat/access";
import type { StickerRef } from "@/lib/chat/types";
import { getDb } from "@/lib/db";
import {
  conversationMembers,
  messages,
  stickerFavorites,
  stickerLibrary,
  stickers,
  users,
} from "@/lib/db/schema";
import { logInfo } from "@/lib/logger";
import { sniffImageMime } from "@/lib/media/validation";
import { getStorageProvider } from "@/lib/storage";
import { isAnimatedStickerSource } from "@/lib/stickers/animated";
import { buildStickerOriginalKey, buildStickerPreviewKey } from "@/lib/stickers/object-keys";
import type { StickerLibraryPayload, StickerListItem, StickerReadUrl } from "@/lib/stickers/types";
import {
  isAllowedStickerOutputMime,
  isAllowedStickerSourceMime,
  isValidStickerName,
  MAX_STICKER_OUTPUT_BYTES,
  MAX_STICKER_SOURCE_BYTES,
  normalizeStickerName,
  RECENT_STICKERS_CAP,
  STICKER_READ_URL_TTL_SECONDS,
  type CreateStickerMeta,
} from "@/lib/stickers/validation";

export class StickerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StickerValidationError";
  }
}

export class StickerNotFoundError extends Error {
  constructor(message = "Couldn't find that.") {
    super(message);
    this.name = "StickerNotFoundError";
  }
}

export class StickerForbiddenError extends Error {
  constructor(message = "You can’t do that.") {
    super(message);
    this.name = "StickerForbiddenError";
  }
}

type StickerRow = typeof stickers.$inferSelect;

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function toListItem(
  row: StickerRow,
  flags: { favorited: boolean; saved: boolean },
): StickerListItem {
  return {
    id: row.id,
    name: row.name,
    animated: row.animated,
    width: row.width,
    height: row.height,
    mimeType: row.mimeType,
    creatorId: row.creatorId,
    createdAt: row.createdAt.toISOString(),
    favorited: flags.favorited,
    saved: flags.saved,
  };
}

function toRef(row: StickerRow, extras: { saved?: boolean } = {}): StickerRef {
  return {
    id: row.id,
    name: row.name,
    animated: row.animated,
    width: row.width,
    height: row.height,
    archived: Boolean(row.archivedAt),
    creatorId: row.creatorId,
    saved: extras.saved,
  };
}

async function conversationMemberIds(conversationId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ userId: conversationMembers.userId })
    .from(conversationMembers)
    .where(eq(conversationMembers.conversationId, conversationId));
  return rows.map((row) => row.userId);
}

async function requireConversation(userId: string, conversationId: string) {
  const allowed = await authorizeConversationAccess(userId, conversationId);
  if (!allowed) {
    throw new StickerForbiddenError();
  }
}

/**
 * A sticker is sendable / library-editable when it is not archived and its
 * creator still belongs to the caller's conversation.
 */
export async function isStickerUsable(params: {
  sticker: Pick<StickerRow, "archivedAt" | "creatorId">;
  conversationId: string;
}): Promise<boolean> {
  if (params.sticker.archivedAt) {
    return false;
  }
  const members = await conversationMemberIds(params.conversationId);
  return members.includes(params.sticker.creatorId);
}

/** Historic chat still needs bytes after the definition leaves the tray. */
async function requireReadableSticker(params: {
  stickerId: string;
  userId: string;
  conversationId: string;
}): Promise<StickerRow> {
  await requireConversation(params.userId, params.conversationId);
  const row = await loadSticker(params.stickerId);
  if (!row) {
    throw new StickerNotFoundError();
  }
  const members = await conversationMemberIds(params.conversationId);
  if (!members.includes(row.creatorId)) {
    throw new StickerNotFoundError();
  }
  return row;
}

async function loadSticker(stickerId: string): Promise<StickerRow | null> {
  const db = getDb();
  return (await db.select().from(stickers).where(eq(stickers.id, stickerId)).limit(1))[0] ?? null;
}

async function requireUsableSticker(params: {
  stickerId: string;
  userId: string;
  conversationId: string;
}): Promise<StickerRow> {
  await requireConversation(params.userId, params.conversationId);
  const row = await loadSticker(params.stickerId);
  if (!row) {
    throw new StickerNotFoundError();
  }
  if (!(await isStickerUsable({ sticker: row, conversationId: params.conversationId }))) {
    throw new StickerNotFoundError("Sticker unavailable.");
  }
  return row;
}

async function membershipFlags(userId: string, stickerIds: string[]) {
  const favorited = new Set<string>();
  const saved = new Set<string>();
  if (stickerIds.length === 0) {
    return { favorited, saved };
  }
  const db = getDb();
  const [favRows, libRows] = await Promise.all([
    db
      .select({ stickerId: stickerFavorites.stickerId })
      .from(stickerFavorites)
      .where(
        and(eq(stickerFavorites.userId, userId), inArray(stickerFavorites.stickerId, stickerIds)),
      ),
    db
      .select({ stickerId: stickerLibrary.stickerId })
      .from(stickerLibrary)
      .where(and(eq(stickerLibrary.userId, userId), inArray(stickerLibrary.stickerId, stickerIds))),
  ]);
  for (const row of favRows) favorited.add(row.stickerId);
  for (const row of libRows) saved.add(row.stickerId);
  return { favorited, saved };
}

async function decorate(userId: string, rows: StickerRow[]): Promise<StickerListItem[]> {
  const flags = await membershipFlags(
    userId,
    rows.map((row) => row.id),
  );
  return rows.map((row) =>
    toListItem(row, {
      favorited: flags.favorited.has(row.id),
      saved: flags.saved.has(row.id),
    }),
  );
}

export async function createSticker(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  bytes: Uint8Array;
  declaredMime: string | null;
  meta: CreateStickerMeta;
}): Promise<StickerListItem> {
  await requireConversation(params.userId, params.conversationId);

  const existing = await loadSticker(params.meta.id);
  if (existing) {
    if (existing.creatorId !== params.userId) {
      throw new StickerValidationError("That sticker couldn't be saved.");
    }
    const [item] = await decorate(params.userId, [existing]);
    return item!;
  }

  if (!isValidStickerName(params.meta.name)) {
    throw new StickerValidationError("That name is a bit long.");
  }

  const sniffed = sniffImageMime(params.bytes);
  if (!sniffed || !isAllowedStickerSourceMime(sniffed)) {
    throw new StickerValidationError("That image can’t become a sticker.");
  }
  if (
    params.declaredMime &&
    params.declaredMime !== sniffed &&
    !(params.declaredMime === "image/jpg" && sniffed === "image/jpeg")
  ) {
    throw new StickerValidationError("That image can’t become a sticker.");
  }

  const animated = Boolean(params.meta.animated) || isAnimatedStickerSource(params.bytes);
  if (params.meta.animated && !isAnimatedStickerSource(params.bytes)) {
    throw new StickerValidationError("That image isn’t animated.");
  }

  const maxBytes = animated ? MAX_STICKER_SOURCE_BYTES : MAX_STICKER_OUTPUT_BYTES;
  if (params.bytes.byteLength > maxBytes) {
    throw new StickerValidationError("That sticker is a bit too large.");
  }
  if (!animated && !isAllowedStickerOutputMime(sniffed)) {
    throw new StickerValidationError("That image can’t become a sticker.");
  }

  const checksum = params.meta.checksum ?? sha256Hex(params.bytes);
  const mimeType = sniffed;
  const storageKey = buildStickerOriginalKey(params.meta.id, mimeType);
  const previewStorageKey = animated ? null : buildStickerPreviewKey(params.meta.id);

  const storage = getStorageProvider();
  await storage.putObject({
    key: storageKey,
    body: params.bytes,
    contentType: mimeType,
    contentLength: params.bytes.byteLength,
  });
  if (previewStorageKey && !animated) {
    await storage.putObject({
      key: previewStorageKey,
      body: params.bytes,
      contentType: mimeType,
      contentLength: params.bytes.byteLength,
    });
  }

  const db = getDb();
  const name = normalizeStickerName(params.meta.name);
  const inserted = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(stickers)
      .values({
        id: params.meta.id,
        creatorId: params.userId,
        storageKey,
        previewStorageKey,
        name,
        animated,
        mimeType,
        width: params.meta.width,
        height: params.meta.height,
        originalSizeBytes: params.bytes.byteLength,
        checksum,
        metadata: {},
      })
      .onConflictDoNothing({ target: stickers.id })
      .returning();

    const sticker =
      row ?? (await tx.select().from(stickers).where(eq(stickers.id, params.meta.id)).limit(1))[0];
    if (!sticker) {
      throw new Error("insert_failed");
    }
    if (sticker.creatorId !== params.userId) {
      throw new StickerValidationError("That sticker couldn't be saved.");
    }

    await tx
      .insert(stickerLibrary)
      .values({
        userId: params.userId,
        stickerId: sticker.id,
      })
      .onConflictDoNothing({
        target: [stickerLibrary.userId, stickerLibrary.stickerId],
      });

    return sticker;
  });

  logInfo({
    requestId: params.requestId,
    operation: "createSticker",
    userId: params.userId,
    extra: { stickerId: inserted.id, animated },
  });

  const [item] = await decorate(params.userId, [inserted]);
  return item!;
}

async function listRecent(params: {
  conversationId: string;
  memberIds: string[];
}): Promise<StickerRow[]> {
  const db = getDb();
  const recent = await db
    .select({
      stickerId: messages.stickerId,
      lastUsed: sql<Date>`max(${messages.createdAt})`.as("last_used"),
    })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, params.conversationId),
        eq(messages.type, "sticker"),
        isNull(messages.deletedAt),
      ),
    )
    .groupBy(messages.stickerId)
    .orderBy(sql`max(${messages.createdAt}) desc`)
    .limit(RECENT_STICKERS_CAP);

  const ids = recent.map((row) => row.stickerId).filter((id): id is string => Boolean(id));
  if (ids.length === 0) {
    return [];
  }

  const rows = await db
    .select()
    .from(stickers)
    .where(and(inArray(stickers.id, ids), isNull(stickers.archivedAt)));
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered: StickerRow[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (row && params.memberIds.includes(row.creatorId)) {
      ordered.push(row);
    }
  }
  return ordered;
}

export async function listStickers(params: {
  userId: string;
  conversationId: string;
}): Promise<StickerLibraryPayload> {
  await requireConversation(params.userId, params.conversationId);
  const partnerId = await getConversationPartnerId(params.conversationId, params.userId);
  const memberIds = await conversationMemberIds(params.conversationId);
  const db = getDb();

  const [recentRows, favoriteJoins, mineRows, partnerRows, partner] = await Promise.all([
    listRecent({ conversationId: params.conversationId, memberIds }),
    db
      .select({ sticker: stickers })
      .from(stickerFavorites)
      .innerJoin(stickers, eq(stickers.id, stickerFavorites.stickerId))
      .where(and(eq(stickerFavorites.userId, params.userId), isNull(stickers.archivedAt)))
      .orderBy(desc(stickerFavorites.createdAt)),
    db
      .select()
      .from(stickers)
      .where(and(eq(stickers.creatorId, params.userId), isNull(stickers.archivedAt)))
      .orderBy(desc(stickers.createdAt)),
    partnerId
      ? db
          .select()
          .from(stickers)
          .where(and(eq(stickers.creatorId, partnerId), isNull(stickers.archivedAt)))
          .orderBy(desc(stickers.createdAt))
      : Promise.resolve([] as StickerRow[]),
    partnerId
      ? db
          .select({ displayName: users.displayName })
          .from(users)
          .where(eq(users.id, partnerId))
          .limit(1)
      : Promise.resolve([] as Array<{ displayName: string }>),
  ]);

  const favoriteRows = favoriteJoins
    .map((row) => row.sticker)
    .filter((row) => memberIds.includes(row.creatorId));

  const [recent, favorites, mine, partnerItems] = await Promise.all([
    decorate(params.userId, recentRows),
    decorate(params.userId, favoriteRows),
    decorate(params.userId, mineRows),
    decorate(params.userId, partnerRows),
  ]);

  return {
    recent,
    favorites,
    mine,
    partner: partnerItems,
    partnerName: partner[0]?.displayName ?? "Them",
  };
}

export async function saveToLibrary(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  stickerId: string;
}): Promise<StickerListItem> {
  const row = await requireUsableSticker(params);
  const db = getDb();
  await db
    .insert(stickerLibrary)
    .values({ userId: params.userId, stickerId: row.id })
    .onConflictDoNothing({ target: [stickerLibrary.userId, stickerLibrary.stickerId] });
  logInfo({
    requestId: params.requestId,
    operation: "saveToLibrary",
    userId: params.userId,
    extra: { stickerId: row.id },
  });
  const [item] = await decorate(params.userId, [row]);
  return item!;
}

export async function removeFromLibrary(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  stickerId: string;
}): Promise<StickerListItem> {
  const row = await requireUsableSticker(params);
  const db = getDb();
  await db
    .delete(stickerLibrary)
    .where(and(eq(stickerLibrary.userId, params.userId), eq(stickerLibrary.stickerId, row.id)));
  logInfo({
    requestId: params.requestId,
    operation: "removeFromLibrary",
    userId: params.userId,
    extra: { stickerId: row.id },
  });
  const [item] = await decorate(params.userId, [row]);
  return item!;
}

export async function setFavorite(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  stickerId: string;
  favorite: boolean;
}): Promise<StickerListItem> {
  const row = await requireUsableSticker(params);
  const db = getDb();
  if (params.favorite) {
    await db
      .insert(stickerFavorites)
      .values({ userId: params.userId, stickerId: row.id })
      .onConflictDoNothing({ target: [stickerFavorites.userId, stickerFavorites.stickerId] });
  } else {
    await db
      .delete(stickerFavorites)
      .where(
        and(eq(stickerFavorites.userId, params.userId), eq(stickerFavorites.stickerId, row.id)),
      );
  }
  logInfo({
    requestId: params.requestId,
    operation: "setFavorite",
    userId: params.userId,
    extra: { stickerId: row.id, favorite: params.favorite },
  });
  const [item] = await decorate(params.userId, [row]);
  return item!;
}

export async function renameSticker(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  stickerId: string;
  name: string | null;
}): Promise<StickerListItem> {
  await requireConversation(params.userId, params.conversationId);
  if (!isValidStickerName(params.name)) {
    throw new StickerValidationError("That name is a bit long.");
  }
  const row = await loadSticker(params.stickerId);
  if (!row || row.archivedAt) {
    throw new StickerNotFoundError();
  }
  if (row.creatorId !== params.userId) {
    throw new StickerForbiddenError();
  }
  const db = getDb();
  const [updated] = await db
    .update(stickers)
    .set({
      name: normalizeStickerName(params.name),
      updatedAt: new Date(),
    })
    .where(eq(stickers.id, row.id))
    .returning();
  logInfo({
    requestId: params.requestId,
    operation: "renameSticker",
    userId: params.userId,
    extra: { stickerId: row.id },
  });
  const [item] = await decorate(params.userId, [updated ?? row]);
  return item!;
}

export async function archiveSticker(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  stickerId: string;
}): Promise<{ id: string; archived: true }> {
  await requireConversation(params.userId, params.conversationId);
  const row = await loadSticker(params.stickerId);
  if (!row) {
    throw new StickerNotFoundError();
  }
  if (row.creatorId !== params.userId) {
    throw new StickerForbiddenError();
  }
  if (row.archivedAt) {
    return { id: row.id, archived: true };
  }

  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .update(stickers)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(stickers.id, row.id));
    await tx.delete(stickerLibrary).where(eq(stickerLibrary.stickerId, row.id));
    await tx.delete(stickerFavorites).where(eq(stickerFavorites.stickerId, row.id));
  });

  logInfo({
    requestId: params.requestId,
    operation: "archiveSticker",
    userId: params.userId,
    extra: { stickerId: row.id },
  });
  return { id: row.id, archived: true };
}

export async function createStickerReadUrl(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  stickerId: string;
}): Promise<StickerReadUrl> {
  const row = await requireReadableSticker(params);
  const storage = getStorageProvider();
  const signed = await storage.createSignedDownloadUrl({
    key: row.storageKey,
    expiresInSeconds: STICKER_READ_URL_TTL_SECONDS,
  });
  logInfo({
    requestId: params.requestId,
    operation: "createStickerReadUrl",
    userId: params.userId,
    extra: { stickerId: row.id },
  });
  return {
    url: signed.url,
    expiresAt: signed.expiresAt,
    stickerId: row.id,
  };
}

/** Batched hydrate for chat messages. Includes archived rows so the UI can fall back. */
export async function loadStickersForMessages(
  stickerIds: Array<string | null | undefined>,
  viewerId?: string,
): Promise<Map<string, StickerRef>> {
  const ids = [...new Set(stickerIds.filter((id): id is string => Boolean(id)))];
  const map = new Map<string, StickerRef>();
  if (ids.length === 0) {
    return map;
  }
  const db = getDb();
  const rows = await db.select().from(stickers).where(inArray(stickers.id, ids));
  const saved = new Set<string>();
  if (viewerId) {
    const libRows = await db
      .select({ stickerId: stickerLibrary.stickerId })
      .from(stickerLibrary)
      .where(and(eq(stickerLibrary.userId, viewerId), inArray(stickerLibrary.stickerId, ids)));
    for (const row of libRows) saved.add(row.stickerId);
  }
  for (const row of rows) {
    map.set(row.id, toRef(row, { saved: saved.has(row.id) }));
  }
  return map;
}

export async function getSendableSticker(params: {
  userId: string;
  conversationId: string;
  stickerId: string;
}): Promise<StickerRow> {
  return requireUsableSticker(params);
}

/**
 * Hard-delete archived stickers that no message references.
 * Historic chat keeps R2 bytes until this runs.
 */
export async function cleanupUnreferencedStickers(): Promise<{ deleted: number }> {
  const db = getDb();
  const orphans = await db.execute(sql`
    SELECT s.id, s.storage_key, s.preview_storage_key
    FROM stickers s
    WHERE s.archived_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM messages m WHERE m.sticker_id = s.id
      )
  `);
  const rows = orphans.rows as Array<{
    id: string;
    storage_key: string;
    preview_storage_key: string | null;
  }>;
  if (rows.length === 0) {
    return { deleted: 0 };
  }

  const storage = getStorageProvider();
  for (const row of rows) {
    await storage.deleteObject(row.storage_key);
    if (row.preview_storage_key) {
      await storage.deleteObject(row.preview_storage_key);
    }
    await db.delete(stickers).where(eq(stickers.id, row.id));
  }

  logInfo({
    requestId: randomUUID(),
    operation: "cleanupUnreferencedStickers",
    extra: { deleted: rows.length },
  });
  return { deleted: rows.length };
}
