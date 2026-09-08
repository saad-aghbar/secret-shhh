import { describe, expect, it } from "vitest";

import { WALLPAPER_ENCODE_QUALITY, WALLPAPER_LONG_EDGE } from "@/lib/appearance/limits";
import { wallpaperTargetSize } from "@/lib/appearance/prepare-image";

describe("wallpaperTargetSize", () => {
  it("leaves images under the long edge untouched", () => {
    expect(wallpaperTargetSize(1200, 800)).toEqual({ width: 1200, height: 800, scale: 1 });
  });

  it("scales the long edge to 2048 and keeps aspect", () => {
    const size = wallpaperTargetSize(4096, 2048);
    expect(size.width).toBe(WALLPAPER_LONG_EDGE);
    expect(size.height).toBe(1024);
    expect(size.scale).toBe(0.5);
  });

  it("handles portrait and square the same way", () => {
    expect(wallpaperTargetSize(1000, 4000)).toEqual({ width: 512, height: 2048, scale: 0.512 });
    expect(wallpaperTargetSize(3000, 3000)).toEqual({ width: 2048, height: 2048, scale: 2048 / 3000 });
  });

  it("guards invalid dimensions", () => {
    expect(wallpaperTargetSize(0, 10).width).toBe(1);
    expect(wallpaperTargetSize(Number.NaN, 10).height).toBe(1);
  });

  it("uses the product encode quality", () => {
    expect(WALLPAPER_ENCODE_QUALITY).toBe(0.86);
  });
});
