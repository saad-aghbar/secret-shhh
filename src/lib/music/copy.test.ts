import { describe, expect, it } from "vitest";

import {
  canEditPlaylist,
  displayArtistName,
  lovedByBoth,
  recommendationGiftCopy,
  recommendationProgressMark,
  recommendationStatusCopy,
  relativeDayLabel,
} from "@/lib/music/copy";

describe("music domain copy", () => {
  it("derives Loved by Both from two favorites", () => {
    expect(lovedByBoth(true, true)).toBe(true);
    expect(lovedByBoth(true, false)).toBe(false);
  });

  it("lets either person edit a collaborative playlist", () => {
    expect(canEditPlaylist({ ownerId: "saad", collaborative: true }, "tala")).toBe(true);
    expect(canEditPlaylist({ ownerId: "saad", collaborative: false }, "tala")).toBe(false);
    expect(canEditPlaylist({ ownerId: "saad", collaborative: false }, "saad")).toBe(true);
  });

  it("uses natural recommendation wording", () => {
    expect(recommendationStatusCopy("pending", false)).toBe("Not listened yet");
    expect(recommendationStatusCopy("loved", true)).toBe("Loved ♡");
    expect(recommendationStatusCopy("not_for_me", false)).toBe("Not for me");
    expect(recommendationGiftCopy("Tala", false)).toBe("Tala sent this for you");
    expect(recommendationGiftCopy("Tala", true)).toBe("You sent this for Tala");
    expect(recommendationProgressMark("pending")).toBe("○");
    expect(recommendationProgressMark("listened")).toBe("✓");
    expect(recommendationProgressMark("loved")).toBe("♡");
  });

  it("labels activity as Today / Yesterday", () => {
    const now = new Date("2026-09-06T18:00:00.000Z");
    expect(relativeDayLabel("2026-09-06T10:00:00.000Z", now)).toBe("Today");
    expect(relativeDayLabel("2026-09-05T10:00:00.000Z", now)).toBe("Yesterday");
  });

  it("hides placeholder artist names", () => {
    expect(displayArtistName("Unknown artist")).toBe("");
    expect(displayArtistName("Rick Astley")).toBe("Rick Astley");
  });
});
