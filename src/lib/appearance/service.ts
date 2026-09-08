import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";

import type { AppearanceTheme, WallpaperConfig } from "@/lib/appearance/config";
import { defaultWallpaperConfig } from "@/lib/appearance/config";
import {
  CONSUMER_APPEARANCE_ERRORS,
  WALLPAPER_READ_URL_TTL_SECONDS,
  WALLPAPER_UPLOAD_TTL_MS,
} from "@/lib/appearance/limits";
import { buildWallpaperDisplayKey } from "@/lib/appearance/object-keys";
import { resolveChatAppearance } from "@/lib/appearance/resolve";
import type { AppearancePayload, WallpaperReadUrl, WallpaperUploadInit } from "@/lib/appearance/types";
import {
  AppearanceValidationError,
  isAllowedWallpaperUploadMime,
  parsePersonalOverride,
  parseWallpaperConfig,
  parseWallpaperConfigLoose,
  validateWallpaperUploadMeta,
} from "@/lib/appearance/validation";
import { authorizeConversationAccess, getConversationPartnerId } from "@/lib/chat/access";
import { getDb } from "@/lib/db";
import { conversations, userPreferences, users, wallpaperAssets } from "@/lib/db/schema";
import { logInfo } from "@/lib/logger";
import { sniffImageMime } from "@/lib/media/validation";
import { broadcastConversationEvent } from "@/lib/realtime/broadcast";
import { getStorageProvider } from "@/lib/storage";

export class AppearanceNotFoundError extends Error {
  constructor(message = CONSUMER_APPEARANCE_ERRORS.NOT_FOUND) {
    super(message);
    this.name = "AppearanceNotFoundError";
  }
}

export class AppearanceForbiddenError extends Error {
  constructor(message = "You can’t do that.") {
    super(message);
    this.name = "AppearanceForbiddenError";
  }
}

type WallpaperAssetRow = typeof wallpaperAssets.$inferSelect;

async function requireConversation(userId: string, conversationId: string) {
  const allowed = await authorizeConversationAccess(userId, conversationId);
  if (!allowed) {
    throw new AppearanceForbiddenError();
  }
}

async function loadConversation(conversationId: string) {
  const db = getDb();
  const row = (
    await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1)
  )[0];
  if (!row) {
    throw new AppearanceNotFoundError();
  }
  return row;
}

async function loadPreferences(userId: string) {
  const db = getDb();
  const existing = (
    await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1)
  )[0];
  if (existing) return existing;
  const [created] = await db.insert(userPreferences).values({ userId }).returning();
  return created;
}

async function partnerNameFor(conversationId: string, userId: string) {
  const partnerId = await getConversationPartnerId(conversationId, userId);
  if (!partnerId) return "your person";
  const db = getDb();
  const row = (await db.select({ displayName: users.displayName }).from(users).where(eq(users.id, partnerId)).limit(1))[0];
  return row?.displayName || "your person";
}

function sharedConfigFromConversation(row: typeof conversations.$inferSelect): WallpaperConfig | Record<string, never> {
  if (row.wallpaperMode === "none") return {};
  const parsed = parseWallpaperConfigLoose(row.wallpaperConfig);
  if (parsed && parsed.type === row.wallpaperMode) {
    if (row.wallpaperMode === "image" && row.wallpaperMediaId) {
      return { ...parsed, assetId: row.wallpaperMediaId };
    }
    return parsed;
  }
  if (row.wallpaperMode === "image" && row.wallpaperMediaId) {
    return { ...defaultWallpaperConfig(), type: "image", assetId: row.wallpaperMediaId };
  }
  return {};
}

async function signedUrlFor(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  assetId?: string;
}): Promise<string | null> {
  if (!params.assetId) return null;
  try {
    const signed = await createWallpaperReadUrl({
      requestId: params.requestId,
      userId: params.userId,
      conversationId: params.conversationId,
      assetId: params.assetId,
    });
    return signed.url;
  } catch {
    return null;
  }
}

async function toPayload(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  personal: unknown;
  conversation: typeof conversations.$inferSelect;
  partnerName: string;
  theme: AppearanceTheme;
}): Promise<AppearancePayload> {
  const personal = parsePersonalOverride(params.personal) ?? {};
  const shared = sharedConfigFromConversation(params.conversation);
  const resolved = resolveChatAppearance({
    personal: params.personal,
    shared: {
      mode: params.conversation.wallpaperMode,
      config: params.conversation.wallpaperConfig,
      mediaId: params.conversation.wallpaperMediaId,
    },
    theme: params.theme,
  });
  const imageUrl = await signedUrlFor({
    requestId: params.requestId,
    userId: params.userId,
    conversationId: params.conversationId,
    assetId: resolved.layer.assetId,
  });
  return {
    personal: personal as AppearancePayload["personal"],
    shared: shared as AppearancePayload["shared"],
    sharedMode: params.conversation.wallpaperMode,
    sharedVersion: params.conversation.wallpaperVersion,
    sharedUpdatedBy: params.conversation.wallpaperUpdatedBy,
    partnerName: params.partnerName,
    resolved,
    imageUrl,
  };
}

export async function getAppearanceForUser(params: {
  requestId?: string;
  userId: string;
  conversationId: string;
  theme?: AppearanceTheme;
}): Promise<AppearancePayload> {
  await requireConversation(params.userId, params.conversationId);
  const [conversation, prefs, partnerName] = await Promise.all([
    loadConversation(params.conversationId),
    loadPreferences(params.userId),
    partnerNameFor(params.conversationId, params.userId),
  ]);
  return toPayload({
    requestId: params.requestId ?? randomUUID(),
    userId: params.userId,
    conversationId: params.conversationId,
    personal: prefs.personalWallpaper ?? {},
    conversation,
    partnerName,
    theme: params.theme ?? "light",
  });
}

async function requireReadyAsset(params: {
  assetId: string;
  userId: string;
  conversationId: string;
  forShared: boolean;
}): Promise<WallpaperAssetRow> {
  const db = getDb();
  const row = (
    await db.select().from(wallpaperAssets).where(eq(wallpaperAssets.id, params.assetId)).limit(1)
  )[0];
  if (!row || row.conversationId !== params.conversationId || row.uploadStatus !== "ready") {
    throw new AppearanceValidationError(CONSUMER_APPEARANCE_ERRORS.NOT_FOUND);
  }
  if (!params.forShared && row.ownerId !== params.userId) {
    throw new AppearanceForbiddenError();
  }
  return row;
}

export async function savePersonalAppearance(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  input: unknown;
  theme?: AppearanceTheme;
}): Promise<AppearancePayload> {
  await requireConversation(params.userId, params.conversationId);
  const config = parseWallpaperConfig(params.input);
  if (config.type === "image" && config.assetId) {
    await requireReadyAsset({
      assetId: config.assetId,
      userId: params.userId,
      conversationId: params.conversationId,
      forShared: false,
    });
  }
  const db = getDb();
  await db
    .insert(userPreferences)
    .values({
      userId: params.userId,
      personalWallpaper: config,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { personalWallpaper: config, updatedAt: new Date() },
    });
  void cleanupUnreferencedWallpaperAssets();
  logInfo({
    requestId: params.requestId,
    operation: "savePersonalAppearance",
    userId: params.userId,
    extra: { type: config.type },
  });
  return getAppearanceForUser({
    userId: params.userId,
    conversationId: params.conversationId,
    theme: params.theme,
  });
}

export async function clearPersonalAppearance(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  theme?: AppearanceTheme;
}): Promise<AppearancePayload> {
  await requireConversation(params.userId, params.conversationId);
  const db = getDb();
  await db
    .insert(userPreferences)
    .values({
      userId: params.userId,
      personalWallpaper: {},
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { personalWallpaper: {}, updatedAt: new Date() },
    });
  void cleanupUnreferencedWallpaperAssets();
  logInfo({
    requestId: params.requestId,
    operation: "clearPersonalAppearance",
    userId: params.userId,
  });
  return getAppearanceForUser({
    userId: params.userId,
    conversationId: params.conversationId,
    theme: params.theme,
  });
}

async function writeShared(params: {
  conversationId: string;
  userId: string;
  mode: WallpaperConfig["type"];
  config: Record<string, unknown>;
  mediaId: string | null;
}) {
  const db = getDb();
  await db.transaction(async (tx) => {
    const current = (
      await tx
        .select({ version: conversations.wallpaperVersion })
        .from(conversations)
        .where(eq(conversations.id, params.conversationId))
        .limit(1)
    )[0];
    await tx
      .update(conversations)
      .set({
        wallpaperMode: params.mode,
        wallpaperConfig: params.config,
        wallpaperMediaId: params.mediaId,
        wallpaperUpdatedBy: params.userId,
        wallpaperVersion: (current?.version ?? 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, params.conversationId));
  });
}

export async function saveSharedAppearance(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  input: unknown;
  theme?: AppearanceTheme;
}): Promise<AppearancePayload> {
  await requireConversation(params.userId, params.conversationId);
  const config = parseWallpaperConfig(params.input);
  if (config.type === "none") {
    return clearSharedAppearance(params);
  }
  if (config.type === "image" && config.assetId) {
    await requireReadyAsset({
      assetId: config.assetId,
      userId: params.userId,
      conversationId: params.conversationId,
      forShared: true,
    });
  }
  await writeShared({
    conversationId: params.conversationId,
    userId: params.userId,
    mode: config.type,
    config,
    mediaId: config.type === "image" ? (config.assetId ?? null) : null,
  });
  const conversation = await loadConversation(params.conversationId);
  void broadcastConversationEvent(params.conversationId, "appearance:changed", {
    version: conversation.wallpaperVersion,
  });
  void cleanupUnreferencedWallpaperAssets();
  logInfo({
    requestId: params.requestId,
    operation: "saveSharedAppearance",
    userId: params.userId,
    extra: { type: config.type, version: conversation.wallpaperVersion },
  });
  return getAppearanceForUser({
    userId: params.userId,
    conversationId: params.conversationId,
    theme: params.theme,
  });
}

export async function clearSharedAppearance(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  theme?: AppearanceTheme;
}): Promise<AppearancePayload> {
  await requireConversation(params.userId, params.conversationId);
  await writeShared({
    conversationId: params.conversationId,
    userId: params.userId,
    mode: "none",
    config: {},
    mediaId: null,
  });
  const conversation = await loadConversation(params.conversationId);
  void broadcastConversationEvent(params.conversationId, "appearance:changed", {
    version: conversation.wallpaperVersion,
  });
  void cleanupUnreferencedWallpaperAssets();
  logInfo({
    requestId: params.requestId,
    operation: "clearSharedAppearance",
    userId: params.userId,
    extra: { version: conversation.wallpaperVersion },
  });
  return getAppearanceForUser({
    userId: params.userId,
    conversationId: params.conversationId,
    theme: params.theme,
  });
}

export async function cleanupUnreferencedWallpaperAssets(): Promise<{ deleted: number }> {
  const db = getDb();
  const orphans = await db.execute(sql`
    SELECT a.id, a.storage_key
    FROM wallpaper_assets a
    WHERE NOT EXISTS (
      SELECT 1 FROM conversations c WHERE c.wallpaper_media_id = a.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM user_preferences p
      WHERE p.personal_wallpaper->>'assetId' = a.id::text
    )
    AND (
      a.upload_status IN ('ready', 'failed', 'aborted')
      OR a.created_at < now() - interval '1 day'
    )
  `);
  const rows = orphans.rows as Array<{ id: string; storage_key: string }>;
  if (rows.length === 0) {
    return { deleted: 0 };
  }

  const storage = getStorageProvider();
  for (const row of rows) {
    await storage.deleteObject(row.storage_key).catch(() => undefined);
    await db.delete(wallpaperAssets).where(eq(wallpaperAssets.id, row.id));
  }

  logInfo({
    requestId: randomUUID(),
    operation: "cleanupUnreferencedWallpaperAssets",
    extra: { deleted: rows.length },
  });
  return { deleted: rows.length };
}

export async function initWallpaperUpload(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
}): Promise<WallpaperUploadInit> {
  await requireConversation(params.userId, params.conversationId);
  const validation = validateWallpaperUploadMeta(params);
  if (!validation.ok) {
    throw new AppearanceValidationError(validation.message);
  }

  const db = getDb();
  const assetId = randomUUID();
  const storageKey = buildWallpaperDisplayKey(params.conversationId, assetId, validation.mimeType);

  const [row] = await db
    .insert(wallpaperAssets)
    .values({
      id: assetId,
      ownerId: params.userId,
      conversationId: params.conversationId,
      storageKey,
      mimeType: validation.mimeType,
      width: params.width,
      height: params.height,
      sizeBytes: params.size,
      uploadStatus: "pending",
    })
    .returning();

  const storage = getStorageProvider();
  const upload = await storage.createSignedUploadUrl({
    key: row.storageKey,
    contentType: validation.mimeType,
    contentLength: params.size,
  });

  logInfo({
    requestId: params.requestId,
    operation: "initWallpaperUpload",
    userId: params.userId,
    extra: { assetId: row.id, storage: storage.name },
  });

  return {
    assetId: row.id,
    storageKey: row.storageKey,
    upload,
  };
}

export async function putWallpaperUploadContent(params: {
  requestId: string;
  userId: string;
  assetId: string;
  body: Uint8Array;
  contentType?: string;
}) {
  const db = getDb();
  const row = (
    await db.select().from(wallpaperAssets).where(eq(wallpaperAssets.id, params.assetId)).limit(1)
  )[0];
  if (!row || row.ownerId !== params.userId) {
    throw new AppearanceNotFoundError();
  }
  if (row.uploadStatus === "ready" || row.uploadStatus === "aborted") {
    throw new AppearanceValidationError(CONSUMER_APPEARANCE_ERRORS.UPLOAD_FAILED);
  }
  if (row.createdAt.getTime() + WALLPAPER_UPLOAD_TTL_MS < Date.now()) {
    await db
      .update(wallpaperAssets)
      .set({ uploadStatus: "aborted" })
      .where(eq(wallpaperAssets.id, row.id));
    throw new AppearanceValidationError(CONSUMER_APPEARANCE_ERRORS.UPLOAD_FAILED);
  }
  if (params.body.byteLength !== row.sizeBytes) {
    throw new AppearanceValidationError(CONSUMER_APPEARANCE_ERRORS.UPLOAD_FAILED);
  }
  if (params.contentType && isAllowedWallpaperUploadMime(params.contentType)) {
    const incoming = params.contentType.trim().toLowerCase().split(";")[0]?.trim();
    if (incoming !== row.mimeType) {
      throw new AppearanceValidationError(CONSUMER_APPEARANCE_ERRORS.UPLOAD_FAILED);
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
    operation: "putWallpaperUploadContent",
    userId: params.userId,
    extra: { assetId: row.id, byteCount: params.body.byteLength },
  });
}

export async function completeWallpaperUpload(params: {
  requestId: string;
  userId: string;
  assetId: string;
}) {
  const db = getDb();
  const row = (
    await db.select().from(wallpaperAssets).where(eq(wallpaperAssets.id, params.assetId)).limit(1)
  )[0];
  if (!row || row.ownerId !== params.userId) {
    throw new AppearanceNotFoundError();
  }
  if (row.uploadStatus === "ready") {
    return { assetId: row.id, status: "ready" as const };
  }
  if (row.uploadStatus === "aborted") {
    throw new AppearanceValidationError(CONSUMER_APPEARANCE_ERRORS.UPLOAD_FAILED);
  }

  const storage = getStorageProvider();
  const meta = await storage.headObject(row.storageKey);
  if (!meta || meta.size !== row.sizeBytes) {
    throw new AppearanceValidationError(CONSUMER_APPEARANCE_ERRORS.UPLOAD_FAILED);
  }
  if (storage.getObjectRange) {
    const head = await storage.getObjectRange(row.storageKey, 0, 15);
    if (head) {
      const sniffed = sniffImageMime(head);
      if (!sniffed || !isAllowedWallpaperUploadMime(sniffed)) {
        await storage.deleteObject(row.storageKey).catch(() => undefined);
        await db
          .update(wallpaperAssets)
          .set({ uploadStatus: "failed" })
          .where(eq(wallpaperAssets.id, row.id));
        throw new AppearanceValidationError(CONSUMER_APPEARANCE_ERRORS.UNSUPPORTED_FORMAT);
      }
    }
  }

  await db
    .update(wallpaperAssets)
    .set({ uploadStatus: "ready" })
    .where(eq(wallpaperAssets.id, row.id));

  logInfo({
    requestId: params.requestId,
    operation: "completeWallpaperUpload",
    userId: params.userId,
    extra: { assetId: row.id },
  });
  return { assetId: row.id, status: "ready" as const };
}

export async function createWallpaperReadUrl(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  assetId: string;
}): Promise<WallpaperReadUrl> {
  await requireConversation(params.userId, params.conversationId);
  const db = getDb();
  const row = (
    await db.select().from(wallpaperAssets).where(eq(wallpaperAssets.id, params.assetId)).limit(1)
  )[0];
  if (!row || row.conversationId !== params.conversationId || row.uploadStatus !== "ready") {
    throw new AppearanceNotFoundError();
  }

  const conversation = await loadConversation(params.conversationId);
  const sharedReferenced = conversation.wallpaperMediaId === row.id;
  const owner = row.ownerId === params.userId;
  if (!sharedReferenced && !owner) {
    throw new AppearanceForbiddenError();
  }

  const storage = getStorageProvider();
  const signed = await storage.createSignedDownloadUrl({
    key: row.storageKey,
    expiresInSeconds: WALLPAPER_READ_URL_TTL_SECONDS,
  });

  logInfo({
    requestId: params.requestId,
    operation: "createWallpaperReadUrl",
    userId: params.userId,
    extra: { assetId: row.id },
  });

  return {
    url: signed.url,
    expiresAt: signed.expiresAt,
    assetId: row.id,
  };
}
