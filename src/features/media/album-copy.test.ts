import { describe, expect, it } from "vitest";

import { albumItemCountLabel, albumMediaNoun } from "@/features/media/album-copy";

describe("album mixed-media copy", () => {
  it("never says photos for a mixed-capable album count", () => {
    expect(albumItemCountLabel(0)).toBe("Nothing yet");
    expect(albumItemCountLabel(1)).toBe("1 item");
    expect(albumItemCountLabel(2)).toBe("2 items");
    expect(albumItemCountLabel(2).toLowerCase()).not.toContain("photo");
  });

  it("names a single item by its real kind", () => {
    expect(albumMediaNoun("video")).toBe("video");
    expect(albumMediaNoun("image")).toBe("photo");
  });
});
