import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bootstrapUserBySlot, type BootstrapResult } from "@/lib/auth/bootstrap";
import { getDb } from "@/lib/db";
import {
  conversationMembers,
  conversations,
  mediaFavorites,
  messageMedia,
  messages,
  sharedAlbumItems,
  sharedAlbums,
} from "@/lib/db/schema";
import {
  addAlbumItems,
  createSharedAlbum,
  deleteSharedAlbum,
  getSharedAlbum,
  listAlbumIdsForMedia,
  listSharedAlbums,
  removeAlbumItems,
  reorderAlbumItems,
  updateSharedAlbum,
} from "@/lib/media/albums-service";
import { setMediaFavorite } from "@/lib/media/favorites-service";
import {
  completeMediaUpload,
  finalizePhotoMessage,
  initMediaUpload,
  listSharedConversationMedia,
  MediaValidationError,
} from "@/lib/media/service";
import { resetStorageProviderCache } from "@/lib/storage";
import { resetTestStorage, writeTestObject } from "@/lib/storage/test-provider";

const canRun = Boolean(process.env.DATABASE_URL);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

describe.skipIf(!canRun)("phase 5 albums + favorites integration", () => {
  const createdMessageIds: string[] = [];
  const createdAlbumIds: string[] = [];
  const createdConversationIds: string[] = [];
  const previousProvider = process.env.STORAGE_PROVIDER;

  let saad: BootstrapResult;
  let tala: BootstrapResult;
  let conversationId: string;
  /** Ready media created once and shared by every case below. */
  let solo: string[] = [];
  let albumOfThree: string[] = [];
  let talaPhoto: string;

  async function sendPhotos(user: BootstrapResult, caption: string, count: number) {
    const clientGeneratedId = randomUUID();
    const assets = [];
    for (let index = 0; index < count; index += 1) {
      const clientAssetId = randomUUID();
      const mediaFolderId = randomUUID();

      const uploadVariant = async (variant: "original" | "preview" | "thumbnail") => {
        const init = await initMediaUpload({
          requestId: randomUUID(),
          userId: user.user.id,
          conversationId: user.conversationId,
          clientGeneratedId,
          clientAssetId,
          variant,
          filename: `p${index}.jpg`,
          mimeType: variant === "original" ? "image/jpeg" : "image/webp",
          size: JPEG.byteLength,
          width: 8,
          height: 8,
          mediaFolderId,
        });
        writeTestObject(
          init.storageKey,
          JPEG,
          variant === "original" ? "image/jpeg" : "image/webp",
        );
        await completeMediaUpload({
          requestId: randomUUID(),
          userId: user.user.id,
          uploadId: init.uploadId,
        });
        return init.uploadId;
      };

      assets.push({
        clientAssetId,
        sortOrder: index,
        originalUploadId: await uploadVariant("original"),
        previewUploadId: await uploadVariant("preview"),
        thumbnailUploadId: await uploadVariant("thumbnail"),
        width: 8,
        height: 8,
        mimeType: "image/jpeg",
        originalFilename: `p${index}.jpg`,
      });
    }

    const message = await finalizePhotoMessage({
      requestId: randomUUID(),
      userId: user.user.id,
      conversationId: user.conversationId,
      clientGeneratedId,
      caption,
      assets,
    });
    createdMessageIds.push(message.id);
    return (message.media ?? []).map((item) => item.id);
  }

  async function makeAlbum(title: string, mediaIds: string[], note?: string) {
    const album = await createSharedAlbum({
      requestId: randomUUID(),
      conversationId,
      userId: saad.user.id,
      title,
      note: note ?? null,
      mediaIds,
    });
    createdAlbumIds.push(album.id);
    return album;
  }

  beforeAll(async () => {
    process.env.STORAGE_PROVIDER = "test";
    resetStorageProviderCache();
    resetTestStorage();

    saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    tala = await bootstrapUserBySlot({ slot: "user_2", displayName: "Tala" });
    conversationId = saad.conversationId;

    solo = [
      ...(await sendPhotos(saad, "phase5 solo a", 1)),
      ...(await sendPhotos(saad, "phase5 solo b", 1)),
    ];
    albumOfThree = await sendPhotos(saad, "phase5 album", 3);
    talaPhoto = (await sendPhotos(tala, "phase5 tala", 1))[0]!;
  }, 60_000);

  afterAll(async () => {
    process.env.STORAGE_PROVIDER = previousProvider;
    resetStorageProviderCache();
    const db = getDb();

    if (createdAlbumIds.length > 0) {
      await db.delete(sharedAlbums).where(inArray(sharedAlbums.id, createdAlbumIds));
    }
    for (const id of createdMessageIds) {
      const media = await db
        .select({ id: messageMedia.id })
        .from(messageMedia)
        .where(eq(messageMedia.messageId, id));
      const ids = media.map((row) => row.id);
      if (ids.length > 0) {
        await db.delete(mediaFavorites).where(inArray(mediaFavorites.mediaId, ids));
        await db.delete(sharedAlbumItems).where(inArray(sharedAlbumItems.mediaId, ids));
      }
      await db.delete(messageMedia).where(eq(messageMedia.messageId, id));
      await db.delete(messages).where(eq(messages.id, id));
    }
    for (const id of createdConversationIds) {
      await db.delete(conversationMembers).where(eq(conversationMembers.conversationId, id));
      await db.delete(conversations).where(eq(conversations.id, id));
    }
  }, 60_000);

  /* ---------- shared media query ---------- */

  it("paginates without duplicates and keeps a stable newest-first order", async () => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    let cursor: string | undefined;

    for (let page = 0; page < 20; page += 1) {
      const result = await listSharedConversationMedia({
        requestId: randomUUID(),
        conversationId,
        userId: saad.user.id,
        limit: 2,
        cursor,
      });
      for (const item of result.items) {
        expect(seen.has(item.id)).toBe(false);
        seen.add(item.id);
        ordered.push(item.createdAt);
      }
      if (!result.nextCursor) break;
      cursor = result.nextCursor;
    }

    expect(seen.size).toBeGreaterThanOrEqual(6);
    const descending = [...ordered].sort().reverse();
    expect(ordered).toEqual(descending);
  });

  it("filters by sender and reverses cleanly with oldest-first sorting", async () => {
    const fromTala = await listSharedConversationMedia({
      requestId: randomUUID(),
      conversationId,
      userId: saad.user.id,
      senderId: tala.user.id,
    });
    expect(fromTala.items.length).toBeGreaterThan(0);
    expect(fromTala.items.every((item) => item.senderId === tala.user.id)).toBe(true);
    expect(fromTala.items.some((item) => item.id === talaPhoto)).toBe(true);

    const oldest = await listSharedConversationMedia({
      requestId: randomUUID(),
      conversationId,
      userId: saad.user.id,
      sort: "oldest",
      limit: 100,
    });
    const times = oldest.items.map((item) => item.createdAt);
    expect(times).toEqual([...times].sort());
  });

  it("expands every attachment of a multi-photo message", async () => {
    const page = await listSharedConversationMedia({
      requestId: randomUUID(),
      conversationId,
      userId: saad.user.id,
      limit: 100,
    });
    const album = page.items.filter((item) => item.caption === "phase5 album");
    expect(album).toHaveLength(3);
    expect(album.every((item) => item.messageAttachmentCount === 3)).toBe(true);
  });

  it("excludes media whose upload never finished", async () => {
    const db = getDb();
    const target = albumOfThree[2]!;
    await db
      .update(messageMedia)
      .set({ uploadStatus: "pending" })
      .where(eq(messageMedia.id, target));

    const page = await listSharedConversationMedia({
      requestId: randomUUID(),
      conversationId,
      userId: saad.user.id,
      limit: 100,
    });
    expect(page.items.some((item) => item.id === target)).toBe(false);

    await db.update(messageMedia).set({ uploadStatus: "ready" }).where(eq(messageMedia.id, target));
  });

  it("filters by local calendar date range", async () => {
    const todayUtc = new Date().toISOString().slice(0, 10);
    const inRange = await listSharedConversationMedia({
      requestId: randomUUID(),
      conversationId,
      userId: saad.user.id,
      from: todayUtc,
      to: todayUtc,
      timeZone: "UTC",
      limit: 100,
    });
    expect(inRange.items.length).toBeGreaterThan(0);

    const longAgo = await listSharedConversationMedia({
      requestId: randomUUID(),
      conversationId,
      userId: saad.user.id,
      from: "2000-01-01",
      to: "2000-01-02",
      timeZone: "UTC",
    });
    expect(longAgo.items).toHaveLength(0);
  });

  /* ---------- albums ---------- */

  it("creates an album, defaults the cover, and lists it", async () => {
    const album = await makeAlbum("Summer 2026", albumOfThree.slice(0, 2), "that week ❤️");

    expect(album.title).toBe("Summer 2026");
    expect(album.note).toBe("that week ❤️");
    expect(album.itemCount).toBe(2);
    expect(album.cover?.mediaId).toBe(albumOfThree[0]);

    const list = await listSharedAlbums({
      requestId: randomUUID(),
      conversationId,
      userId: tala.user.id,
    });
    // Both participants see the same albums.
    expect(list.some((entry) => entry.id === album.id)).toBe(true);
  });

  it("accepts Arabic and mixed-script titles and notes", async () => {
    const album = await makeAlbum("ذكرياتنا 2026", [talaPhoto], "أجمل أسبوع — best week ❤️");
    expect(album.title).toBe("ذكرياتنا 2026");
    expect(album.note).toContain("أجمل");
    expect(album.note).toContain("best week");
  });

  it("rejects titles and notes past their limits", async () => {
    await expect(
      createSharedAlbum({
        requestId: randomUUID(),
        conversationId,
        userId: saad.user.id,
        title: "x".repeat(81),
      }),
    ).rejects.toBeInstanceOf(MediaValidationError);

    await expect(
      createSharedAlbum({
        requestId: randomUUID(),
        conversationId,
        userId: saad.user.id,
        title: "ok",
        note: "n".repeat(501),
      }),
    ).rejects.toBeInstanceOf(MediaValidationError);

    await expect(
      createSharedAlbum({
        requestId: randomUUID(),
        conversationId,
        userId: saad.user.id,
        title: "   ",
      }),
    ).rejects.toBeInstanceOf(MediaValidationError);
  });

  it("lets either participant edit the title and note", async () => {
    const album = await makeAlbum("Draft", solo.slice(0, 1));
    const updated = await updateSharedAlbum({
      requestId: randomUUID(),
      conversationId,
      userId: tala.user.id,
      albumId: album.id,
      title: "Random us",
      note: "the good ones",
    });
    expect(updated.title).toBe("Random us");
    expect(updated.note).toBe("the good ones");

    const cleared = await updateSharedAlbum({
      requestId: randomUUID(),
      conversationId,
      userId: tala.user.id,
      albumId: album.id,
      note: null,
    });
    expect(cleared.note).toBeNull();
  });

  it("adds items idempotently so a duplicate tap cannot double-insert", async () => {
    const album = await makeAlbum("Adds", [albumOfThree[0]!]);

    const once = await addAlbumItems({
      requestId: randomUUID(),
      conversationId,
      userId: tala.user.id,
      albumId: album.id,
      mediaIds: [albumOfThree[1]!],
    });
    expect(once.itemCount).toBe(2);

    const twice = await addAlbumItems({
      requestId: randomUUID(),
      conversationId,
      userId: tala.user.id,
      albumId: album.id,
      mediaIds: [albumOfThree[1]!, albumOfThree[0]!],
    });
    expect(twice.itemCount).toBe(2);
  });

  it("removing an item leaves the chat message and media untouched", async () => {
    const mediaId = albumOfThree[0]!;
    const album = await makeAlbum("Removal safety", [mediaId, albumOfThree[1]!]);

    const after = await removeAlbumItems({
      requestId: randomUUID(),
      conversationId,
      userId: saad.user.id,
      albumId: album.id,
      mediaIds: [mediaId],
    });
    expect(after.itemCount).toBe(1);

    const db = getDb();
    const stillThere = await db
      .select({ id: messageMedia.id, status: messageMedia.uploadStatus })
      .from(messageMedia)
      .where(eq(messageMedia.id, mediaId));
    expect(stillThere).toHaveLength(1);
    expect(stillThere[0]?.status).toBe("ready");

    const library = await listSharedConversationMedia({
      requestId: randomUUID(),
      conversationId,
      userId: saad.user.id,
      limit: 100,
    });
    expect(library.items.some((item) => item.id === mediaId)).toBe(true);
  });

  it("re-points the cover when the cover photo is removed", async () => {
    const album = await makeAlbum("Cover fallback", [albumOfThree[0]!, albumOfThree[1]!]);
    expect(album.cover?.mediaId).toBe(albumOfThree[0]);

    const after = await removeAlbumItems({
      requestId: randomUUID(),
      conversationId,
      userId: saad.user.id,
      albumId: album.id,
      mediaIds: [albumOfThree[0]!],
    });
    expect(after.cover?.mediaId).toBe(albumOfThree[1]);
  });

  it("shows a beautiful-empty album rather than a dangling cover", async () => {
    const album = await makeAlbum("Emptied", [solo[0]!]);
    const after = await removeAlbumItems({
      requestId: randomUUID(),
      conversationId,
      userId: saad.user.id,
      albumId: album.id,
      mediaIds: [solo[0]!],
    });
    expect(after.itemCount).toBe(0);
    expect(after.cover).toBeNull();
  });

  it("only accepts a cover that belongs to the album", async () => {
    const album = await makeAlbum("Cover rules", [albumOfThree[0]!, albumOfThree[1]!]);

    const changed = await updateSharedAlbum({
      requestId: randomUUID(),
      conversationId,
      userId: tala.user.id,
      albumId: album.id,
      coverMediaId: albumOfThree[1]!,
    });
    expect(changed.cover?.mediaId).toBe(albumOfThree[1]);

    await expect(
      updateSharedAlbum({
        requestId: randomUUID(),
        conversationId,
        userId: saad.user.id,
        albumId: album.id,
        coverMediaId: talaPhoto,
      }),
    ).rejects.toBeInstanceOf(MediaValidationError);
  });

  it("persists a new order and rejects a stale one", async () => {
    const album = await makeAlbum("Ordering", albumOfThree.slice(0, 3));
    const original = album.items.map((item) => item.id);

    const reversed = [...original].reverse();
    const after = await reorderAlbumItems({
      requestId: randomUUID(),
      conversationId,
      userId: tala.user.id,
      albumId: album.id,
      mediaIds: reversed,
    });
    expect(after.items.map((item) => item.id)).toEqual(reversed);

    const reloaded = await getSharedAlbum({
      requestId: randomUUID(),
      conversationId,
      userId: saad.user.id,
      albumId: album.id,
    });
    expect(reloaded.items.map((item) => item.id)).toEqual(reversed);

    await expect(
      reorderAlbumItems({
        requestId: randomUUID(),
        conversationId,
        userId: saad.user.id,
        albumId: album.id,
        mediaIds: original.slice(0, 2),
      }),
    ).rejects.toBeInstanceOf(MediaValidationError);
  });

  it("deleting an album keeps every photo and message alive", async () => {
    const album = await makeAlbum("Doomed", albumOfThree.slice(0, 2));
    const messageIdBefore = album.items[0]!.messageId;

    await deleteSharedAlbum({
      requestId: randomUUID(),
      conversationId,
      userId: tala.user.id,
      albumId: album.id,
    });

    await expect(
      getSharedAlbum({
        requestId: randomUUID(),
        conversationId,
        userId: saad.user.id,
        albumId: album.id,
      }),
    ).rejects.toBeInstanceOf(MediaValidationError);

    const db = getDb();
    const message = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.id, messageIdBefore));
    expect(message).toHaveLength(1);

    const media = await db
      .select({ id: messageMedia.id })
      .from(messageMedia)
      .where(inArray(messageMedia.id, albumOfThree.slice(0, 2)));
    expect(media).toHaveLength(2);

    const orphans = await db
      .select({ mediaId: sharedAlbumItems.mediaId })
      .from(sharedAlbumItems)
      .where(eq(sharedAlbumItems.albumId, album.id));
    expect(orphans).toHaveLength(0);
  });

  it("reports which albums a photo already belongs to", async () => {
    const album = await makeAlbum("Membership", [solo[1]!]);
    const ids = await listAlbumIdsForMedia({ conversationId, mediaId: solo[1]! });
    expect(ids).toContain(album.id);
  });

  /* ---------- favorites ---------- */

  it("is unique per person and idempotent", async () => {
    const mediaId = solo[0]!;
    await setMediaFavorite({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId,
      mediaId,
      favorite: true,
    });
    const repeated = await setMediaFavorite({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId,
      mediaId,
      favorite: true,
    });
    expect(repeated.favoritedBy).toEqual([saad.user.id]);

    const db = getDb();
    const rows = await db
      .select({ userId: mediaFavorites.userId })
      .from(mediaFavorites)
      .where(eq(mediaFavorites.mediaId, mediaId));
    expect(rows).toHaveLength(1);

    const off = await setMediaFavorite({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId,
      mediaId,
      favorite: false,
    });
    expect(off.favoritedBy).toHaveLength(0);
  });

  it("derives loved-by-both from the two favorite rows", async () => {
    const mediaId = solo[1]!;
    await setMediaFavorite({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId,
      mediaId,
      favorite: true,
    });

    let page = await listSharedConversationMedia({
      requestId: randomUUID(),
      conversationId,
      userId: saad.user.id,
      favorites: "both",
      limit: 100,
    });
    expect(page.items.some((item) => item.id === mediaId)).toBe(false);

    await setMediaFavorite({
      requestId: randomUUID(),
      userId: tala.user.id,
      conversationId,
      mediaId,
      favorite: true,
    });

    page = await listSharedConversationMedia({
      requestId: randomUUID(),
      conversationId,
      userId: saad.user.id,
      favorites: "both",
      limit: 100,
    });
    const found = page.items.find((item) => item.id === mediaId);
    expect(found).toBeDefined();
    expect(found?.favoritedBy).toHaveLength(2);

    const mine = await listSharedConversationMedia({
      requestId: randomUUID(),
      conversationId,
      userId: tala.user.id,
      favorites: "mine",
      limit: 100,
    });
    expect(mine.items.some((item) => item.id === mediaId)).toBe(true);

    // Cleanup so later runs start from a clean heart state.
    for (const userId of [saad.user.id, tala.user.id]) {
      await setMediaFavorite({
        requestId: randomUUID(),
        userId,
        conversationId,
        mediaId,
        favorite: false,
      });
    }
  });

  /* ---------- authorization ---------- */

  describe("authorization", () => {
    let otherConversationId: string;
    let outsideMediaId: string;

    beforeAll(async () => {
      const db = getDb();
      const [created] = await db
        .insert(conversations)
        .values({ title: "phase5 outsider" })
        .returning();
      otherConversationId = created!.id;
      createdConversationIds.push(otherConversationId);
      await db.insert(conversationMembers).values({
        conversationId: otherConversationId,
        userId: saad.user.id,
      });

      const [message] = await db
        .insert(messages)
        .values({
          conversationId: otherConversationId,
          senderId: saad.user.id,
          clientGeneratedId: randomUUID(),
          type: "image",
        })
        .returning();
      createdMessageIds.push(message!.id);

      const [media] = await db
        .insert(messageMedia)
        .values({
          messageId: message!.id,
          uploaderId: saad.user.id,
          mediaType: "image",
          mimeType: "image/jpeg",
          storageKey: `outside/${randomUUID()}.jpg`,
          originalSizeBytes: 16,
          uploadStatus: "ready",
        })
        .returning();
      outsideMediaId = media!.id;
    });

    it("refuses media from another conversation", async () => {
      const album = await makeAlbum("Fence", [solo[0]!]);
      await expect(
        addAlbumItems({
          requestId: randomUUID(),
          conversationId,
          userId: saad.user.id,
          albumId: album.id,
          mediaIds: [outsideMediaId],
        }),
      ).rejects.toBeInstanceOf(MediaValidationError);
    });

    it("refuses album access from another conversation", async () => {
      const album = await makeAlbum("Private", [solo[0]!]);
      await expect(
        getSharedAlbum({
          requestId: randomUUID(),
          conversationId: otherConversationId,
          userId: saad.user.id,
          albumId: album.id,
        }),
      ).rejects.toBeInstanceOf(MediaValidationError);

      await expect(
        deleteSharedAlbum({
          requestId: randomUUID(),
          conversationId: otherConversationId,
          userId: saad.user.id,
          albumId: album.id,
        }),
      ).rejects.toBeInstanceOf(MediaValidationError);
    });

    it("refuses to favorite media the user cannot reach", async () => {
      await expect(
        setMediaFavorite({
          requestId: randomUUID(),
          userId: tala.user.id,
          conversationId: otherConversationId,
          mediaId: outsideMediaId,
          favorite: true,
        }),
      ).rejects.toBeInstanceOf(MediaValidationError);

      const db = getDb();
      const rows = await db
        .select({ userId: mediaFavorites.userId })
        .from(mediaFavorites)
        .where(
          and(eq(mediaFavorites.mediaId, outsideMediaId), eq(mediaFavorites.userId, tala.user.id)),
        );
      expect(rows).toHaveLength(0);
    });

    it("never surfaces another conversation's media in the library", async () => {
      const page = await listSharedConversationMedia({
        requestId: randomUUID(),
        conversationId,
        userId: saad.user.id,
        limit: 100,
      });
      expect(page.items.some((item) => item.id === outsideMediaId)).toBe(false);
    });
  });
});
