import { afterEach, describe, expect, it, vi } from "vitest";

import {
  encodeCanvasDerivative,
  derivativeFilenameStem,
  PREPARE_PHOTO_ERROR,
} from "@/lib/media/encode-derivative";

function mockCanvas(handler: (type: string) => Blob | null): HTMLCanvasElement {
  const canvas = {
    width: 8,
    height: 8,
    toBlob(callback: (blob: Blob | null) => void, type?: string) {
      callback(handler(type ?? "image/png"));
    },
  };
  return canvas as unknown as HTMLCanvasElement;
}

describe("encodeCanvasDerivative", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns WebP mime when WebP encode succeeds", async () => {
    const webp = new Blob([new Uint8Array([1, 2, 3])], { type: "" });
    const canvas = mockCanvas((type) => (type === "image/webp" ? webp : null));
    const result = await encodeCanvasDerivative(canvas, 0.8);
    expect(result.mimeType).toBe("image/webp");
    expect(result.blob.type).toBe("image/webp");
    expect(result.blob.size).toBe(webp.size);
  });

  it("falls back to JPEG with explicit mime when WebP returns null", async () => {
    const jpeg = new Blob([new Uint8Array([4, 5, 6])], { type: "" });
    const canvas = mockCanvas((type) => {
      if (type === "image/webp") return null;
      if (type === "image/jpeg") return jpeg;
      return null;
    });
    const result = await encodeCanvasDerivative(canvas, 0.8);
    expect(result.mimeType).toBe("image/jpeg");
    expect(result.blob.type).toBe("image/jpeg");
    expect(result.blob.size).toBe(jpeg.size);
  });

  it("falls back to JPEG when WebP throws", async () => {
    const jpeg = new Blob([new Uint8Array([7, 8])], { type: "image/png" });
    const canvas = {
      toBlob(callback: (blob: Blob | null) => void, type?: string) {
        if (type === "image/webp") throw new Error("webp unsupported");
        callback(type === "image/jpeg" ? jpeg : null);
      },
    } as unknown as HTMLCanvasElement;
    const result = await encodeCanvasDerivative(canvas, 0.8);
    expect(result.mimeType).toBe("image/jpeg");
    expect(result.blob.type).toBe("image/jpeg");
  });

  it("throws consumer-safe error when both encoders fail", async () => {
    const canvas = mockCanvas(() => null);
    await expect(encodeCanvasDerivative(canvas, 0.8)).rejects.toThrow(PREPARE_PHOTO_ERROR);
  });

  it("never trusts blob.type for mimeType", async () => {
    const jpeg = new Blob([new Uint8Array([1])], { type: "image/webp" });
    const canvas = mockCanvas((type) => (type === "image/jpeg" ? jpeg : null));
    const result = await encodeCanvasDerivative(canvas, 0.8);
    expect(result.mimeType).toBe("image/jpeg");
    expect(jpeg.type).toBe("image/webp");
  });

  it("falls back to JPEG when Safari returns PNG bytes as WebP", async () => {
    const pngAsWebp = new Blob(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0])],
      { type: "image/webp" },
    );
    const jpeg = new Blob(
      [new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])],
      { type: "" },
    );
    const canvas = mockCanvas((type) => (type === "image/webp" ? pngAsWebp : jpeg));
    const result = await encodeCanvasDerivative(canvas, 0.8);
    expect(result.mimeType).toBe("image/jpeg");
  });
});

describe("derivativeFilenameStem", () => {
  it("maps derivative mime to filename extension", () => {
    expect(derivativeFilenameStem("image/webp")).toBe("webp");
    expect(derivativeFilenameStem("image/jpeg")).toBe("jpg");
  });
});
