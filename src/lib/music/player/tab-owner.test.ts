import { describe, expect, it } from "vitest";

import { ownsMusicTab } from "@/lib/music/player/tab-owner";

describe("music tab ownership", () => {
  it("is permissive when storage is empty", () => {
    expect(ownsMusicTab()).toBe(true);
  });
});
