import { describe, expect, it } from "vitest";

import {
  buildMediaObjectKey,
  mediaFolderPrefix,
  objectKeyForVariant,
} from "@/lib/storage/object-keys";
import { mapMediaErrorToConsumer } from "@/lib/media/consumer-errors";
import {
  isAllowedImageMime,
  isRejectedImageMime,
  sanitizeOriginalFilename,
  sniffImageMime,
  validateDerivativeUploadMeta,
  validateImageUploadMeta,
  validateOriginalUploadMeta,
} from "@/lib/media/validation";
import { createTestStorageProvider, resetTestStorage } from "@/lib/storage/test-provider";

describe("media object keys", () => {
  it("builds unpredictable media paths without filenames", () => {
    const key = buildMediaObjectKey({
      conversationId: "conv-1",
      mediaUuid: "11111111-1111-1111-1111-111111111111",
      variant: "original",
      now: new Date("2026-09-01T12:00:00Z"),
    });
    expect(key).toBe("media/conv-1/2026/09/11111111-1111-1111-1111-111111111111/original");
    expect(key.includes("photo.jpg")).toBe(false);
  });

  it("keeps original/preview/thumb under one folder", () => {
    const folder = mediaFolderPrefix("c", "m", new Date("2026-03-15T00:00:00Z"));
    expect(objectKeyForVariant(folder, "preview")).toBe(`${folder}/preview.webp`);
    expect(objectKeyForVariant(folder, "thumbnail")).toBe(`${folder}/thumb.webp`);
    expect(objectKeyForVariant(folder, "preview", "image/jpeg")).toBe(`${folder}/preview.jpg`);
    expect(objectKeyForVariant(folder, "thumbnail", "image/jpeg")).toBe(`${folder}/thumb.jpg`);
  });
});

describe("image validation", () => {
  it("allows jpeg/png/webp and rejects svg", () => {
    expect(isAllowedImageMime("image/jpeg")).toBe(true);
    expect(isAllowedImageMime("image/png")).toBe(true);
    expect(isRejectedImageMime("image/svg+xml")).toBe(true);
    expect(
      validateImageUploadMeta({
        mimeType: "image/svg+xml",
        size: 100,
        variant: "original",
      }).ok,
    ).toBe(false);
  });

  it("allows PNG originals", () => {
    expect(validateOriginalUploadMeta({ mimeType: "image/png", size: 100 }).ok).toBe(true);
  });

  it("rejects PNG for derivative validation internally", () => {
    const result = validateDerivativeUploadMeta({ mimeType: "image/png", size: 100 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/Preview files must/);
      expect(mapMediaErrorToConsumer(result.message)).toBe("Couldn't prepare this photo.");
    }
  });

  it("allows JPEG and WebP derivatives", () => {
    expect(validateDerivativeUploadMeta({ mimeType: "image/jpeg", size: 100 }).ok).toBe(true);
    expect(validateDerivativeUploadMeta({ mimeType: "image/webp", size: 100 }).ok).toBe(true);
  });

  it("never exposes internal derivative MIME copy to consumers", () => {
    const mapped = mapMediaErrorToConsumer("Preview files must be WebP or JPEG.");
    expect(mapped).toBe("Couldn't prepare this photo.");
    expect(mapped).not.toMatch(/Preview files must/);
  });

  it("rejects oversized originals with warm copy", () => {
    const result = validateImageUploadMeta({
      mimeType: "image/jpeg",
      size: 200_000_000,
      variant: "original",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/too large/i);
    }
  });

  it("sniffs jpeg/png magic bytes", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(sniffImageMime(jpeg)).toBe("image/jpeg");
    expect(sniffImageMime(png)).toBe("image/png");
  });

  it("sanitizes filenames for headers", () => {
    expect(sanitizeOriginalFilename("../../evil\nname.jpg")).toBe("evil_name.jpg");
  });
});

describe("test storage provider", () => {
  it("round-trips put/head/get/delete", async () => {
    resetTestStorage();
    const storage = createTestStorageProvider("http://localhost:3000");
    const key = "media/test/original";
    const body = new Uint8Array([1, 2, 3, 4]);
    await storage.putObject?.({
      key,
      body,
      contentType: "image/jpeg",
      contentLength: body.byteLength,
    });
    const meta = await storage.headObject(key);
    expect(meta?.size).toBe(4);
    const bytes = await storage.getObjectBytes?.(key);
    expect(bytes ? [...bytes] : null).toEqual([1, 2, 3, 4]);
    const signed = await storage.createSignedDownloadUrl({ key });
    expect(signed.url).toContain("/api/test-storage/download/");
    await storage.deleteObject(key);
    expect(await storage.headObject(key)).toBeNull();
  });
});
