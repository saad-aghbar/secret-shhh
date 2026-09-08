import { describe, expect, it } from "vitest";

import {
  canonicalizeImageSourceMime,
  isHeicImageSource,
  isRejectedImageSource,
} from "@/lib/media/source-mime";

describe("canonicalizeImageSourceMime", () => {
  it("retags iPhone and alias MIME types", () => {
    expect(canonicalizeImageSourceMime("image/jpg")).toBe("image/jpeg");
    expect(canonicalizeImageSourceMime("image/x-png")).toBe("image/png");
    expect(canonicalizeImageSourceMime("image/heif")).toBe("image/heic");
    expect(canonicalizeImageSourceMime("image/png; charset=binary")).toBe("image/png");
  });

  it("fills empty MIME from the filename", () => {
    expect(canonicalizeImageSourceMime("", "IMG_1234.PNG")).toBe("image/png");
    expect(canonicalizeImageSourceMime("application/octet-stream", "IMG_1234.HEIC")).toBe(
      "image/heic",
    );
    expect(canonicalizeImageSourceMime("", "photo.jpeg")).toBe("image/jpeg");
  });

  it("detects HEIC and rejects SVG", () => {
    expect(isHeicImageSource("", "screenshot.heic")).toBe(true);
    expect(isHeicImageSource("image/heif", "photo")).toBe(true);
    expect(isRejectedImageSource("image/svg+xml", "x.svg")).toBe(true);
    expect(isRejectedImageSource("image/png", "shot.png")).toBe(false);
  });
});
