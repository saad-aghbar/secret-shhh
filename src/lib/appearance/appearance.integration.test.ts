import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { configFromColor, configFromDefault } from "@/lib/appearance/presets";
import {
  cleanupUnreferencedWallpaperAssets,
  clearPersonalAppearance,
  clearSharedAppearance,
  completeWallpaperUpload,
  createWallpaperReadUrl,
  getAppearanceForUser,
  initWallpaperUpload,
  putWallpaperUploadContent,
  savePersonalAppearance,
  saveSharedAppearance,
} from "@/lib/appearance/service";
import { AppearanceForbiddenError, AppearanceNotFoundError } from "@/lib/appearance/service";
import { AppearanceValidationError } from "@/lib/appearance/validation";
import { bootstrapUserBySlot } from "@/lib/auth/bootstrap";
import { getDb } from "@/lib/db";
import { conversations, userPreferences, wallpaperAssets } from "@/lib/db/schema";
import { resetStorageProviderCache } from "@/lib/storage";
import { resetTestStorage } from "@/lib/storage/test-provider";
import { STILL_WEBP, TINY_PNG } from "@/lib/stickers/fixtures";

const canRun = Boolean(process.env.DATABASE_URL);

async function resetAppearanceTables() {
  const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
  const tala = await bootstrapUserBySlot({ slot: "user_2", displayName: "Tala" });
  const db = getDb();
  await db
    .update(userPreferences)
    .set({ personalWallpaper: {} })
    .where(eq(userPreferences.userId, saad.user.id));
  await db
    .update(userPreferences)
    .set({ personalWallpaper: {} })
    .where(eq(userPreferences.userId, tala.user.id));
  await db
    .update(conversations)
    .set({
      wallpaperMode: "none",
      wallpaperConfig: {},
      wallpaperMediaId: null,
      wallpaperVersion: 0,
      wallpaperUpdatedBy: null,
    })
    .where(eq(conversations.id, saad.conversationId));
}

describe.skipIf(!canRun)("phase 11 appearance integration", { timeout: 20_000 }, () => {
  const previousProvider = process.env.STORAGE_PROVIDER;

  beforeAll(async () => {
    process.env.STORAGE_PROVIDER = "test";
    resetStorageProviderCache();
    resetTestStorage();
  });

  beforeEach(async () => {
    await resetAppearanceTables();
  });

  afterAll(async () => {
    process.env.STORAGE_PROVIDER = previousProvider;
    resetStorageProviderCache();
    await resetAppearanceTables();
    await getDb().delete(wallpaperAssets);
  });

  it("persists personal and shared wallpapers with the documented precedence", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const tala = await bootstrapUserBySlot({ slot: "user_2", displayName: "Tala" });

    await saveSharedAppearance({
      requestId: randomUUID(),
      userId: tala.user.id,
      conversationId: tala.conversationId,
      input: configFromColor("#4a756c"),
    });

    const saadSeesShared = await getAppearanceForUser({
      userId: saad.user.id,
      conversationId: saad.conversationId,
    });
    expect(saadSeesShared.resolved.source).toBe("shared");
    expect(saadSeesShared.resolved.layer.color).toBe("#4a756c");
    expect(saadSeesShared.sharedVersion).toBeGreaterThan(0);

    await savePersonalAppearance({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      input: configFromColor("#d9899c"),
    });
    const saadOverride = await getAppearanceForUser({
      userId: saad.user.id,
      conversationId: saad.conversationId,
    });
    expect(saadOverride.resolved.source).toBe("personal");
    expect(saadOverride.resolved.layer.color).toBe("#d9899c");

    const talaStillShared = await getAppearanceForUser({
      userId: tala.user.id,
      conversationId: tala.conversationId,
    });
    expect(talaStillShared.resolved.source).toBe("shared");
    expect(talaStillShared.resolved.layer.color).toBe("#4a756c");

    await savePersonalAppearance({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      input: configFromDefault(),
    });
    const saadDefault = await getAppearanceForUser({
      userId: saad.user.id,
      conversationId: saad.conversationId,
    });
    expect(saadDefault.resolved.source).toBe("personal");
    expect(saadDefault.resolved.layer.type).toBe("none");

    await clearPersonalAppearance({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
    });
    const saadFallback = await getAppearanceForUser({
      userId: saad.user.id,
      conversationId: saad.conversationId,
    });
    expect(saadFallback.resolved.source).toBe("shared");

    await clearSharedAppearance({
      requestId: randomUUID(),
      userId: tala.user.id,
      conversationId: tala.conversationId,
    });
    const bothDefault = await getAppearanceForUser({
      userId: saad.user.id,
      conversationId: saad.conversationId,
    });
    expect(bothDefault.resolved.source).toBe("default");
  });

  it("authorizes wallpaper assets and cleans unreferenced ones", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const tala = await bootstrapUserBySlot({ slot: "user_2", displayName: "Tala" });

    const init = await initWallpaperUpload({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      mimeType: "image/webp",
      size: STILL_WEBP.byteLength,
      width: 1,
      height: 1,
    });
    await putWallpaperUploadContent({
      requestId: randomUUID(),
      userId: saad.user.id,
      assetId: init.assetId,
      body: STILL_WEBP,
      contentType: "image/webp",
    });
    await completeWallpaperUpload({
      requestId: randomUUID(),
      userId: saad.user.id,
      assetId: init.assetId,
    });

    await savePersonalAppearance({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      input: { ...configFromDefault(), type: "image", assetId: init.assetId },
    });

    const ownUrl = await createWallpaperReadUrl({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      assetId: init.assetId,
    });
    expect(ownUrl.url).toBeTruthy();

    await expect(
      createWallpaperReadUrl({
        requestId: randomUUID(),
        userId: tala.user.id,
        conversationId: tala.conversationId,
        assetId: init.assetId,
      }),
    ).rejects.toBeInstanceOf(AppearanceForbiddenError);

    await saveSharedAppearance({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      input: { ...configFromDefault(), type: "image", assetId: init.assetId },
    });
    const partnerUrl = await createWallpaperReadUrl({
      requestId: randomUUID(),
      userId: tala.user.id,
      conversationId: tala.conversationId,
      assetId: init.assetId,
    });
    expect(partnerUrl.url).toBeTruthy();

    await expect(
      savePersonalAppearance({
        requestId: randomUUID(),
        userId: saad.user.id,
        conversationId: saad.conversationId,
        input: { version: 99, type: "solid", color: "#4a756c" },
      }),
    ).rejects.toBeInstanceOf(AppearanceValidationError);

    await clearSharedAppearance({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
    });
    await clearPersonalAppearance({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
    });
    await cleanupUnreferencedWallpaperAssets();

    await expect(
      createWallpaperReadUrl({
        requestId: randomUUID(),
        userId: saad.user.id,
        conversationId: saad.conversationId,
        assetId: init.assetId,
      }),
    ).rejects.toBeInstanceOf(AppearanceNotFoundError);
  });

  it("accepts a PNG wallpaper the way iPhone screenshots often arrive", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const init = await initWallpaperUpload({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      mimeType: "image/png",
      size: TINY_PNG.byteLength,
      width: 1,
      height: 1,
    });
    expect(init.upload.url).toBeTruthy();
    await putWallpaperUploadContent({
      requestId: randomUUID(),
      userId: saad.user.id,
      assetId: init.assetId,
      body: TINY_PNG,
      contentType: "image/png",
    });
    await expect(
      completeWallpaperUpload({
        requestId: randomUUID(),
        userId: saad.user.id,
        assetId: init.assetId,
      }),
    ).resolves.toEqual({ assetId: init.assetId, status: "ready" });
  });
});
