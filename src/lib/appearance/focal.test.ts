import { describe, expect, it } from "vitest";

import { clampZoom, moveFocal, wallpaperPhotoTransform } from "@/lib/appearance/focal";

describe("moveFocal", () => {
  it("moves the photo with the drag", () => {
    expect(moveFocal({ focalX: 0.5, focalY: 0.5 }, { dx: 0.2, dy: -0.1 }, 1)).toEqual({
      focalX: 0.3,
      focalY: 0.6,
    });
  });

  it("stays inside 0–1", () => {
    const next = moveFocal({ focalX: 0.05, focalY: 0.95 }, { dx: 0.4, dy: -0.4 }, 1);
    expect(next.focalX).toBe(0);
    expect(next.focalY).toBe(1);
  });

  it("clamps zoom to the product range", () => {
    expect(clampZoom(0.2)).toBe(1);
    expect(clampZoom(8)).toBe(3);
  });
});

describe("wallpaperPhotoTransform", () => {
  it("keeps a centered photo still", () => {
    expect(wallpaperPhotoTransform(0.5, 0.5, 1)).toBe("translate(0.000%, 0.000%) scale(1)");
  });

  it("scrolls the zoomed photo with the drag", () => {
    expect(wallpaperPhotoTransform(0.3, 0.6, 2)).toBe("translate(40.000%, -20.000%) scale(2)");
  });
});
