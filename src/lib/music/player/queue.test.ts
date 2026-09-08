import { describe, expect, it } from "vitest";

import { clipBounds, createQueue, currentItem, nextIndex, previousIndex, shuffledCopy } from "@/lib/music/player/queue";

const items = [
  { trackId: "a", title: "A", artistName: "x", artworkUrl: null, youtubeVideoId: "aaaaaaaaaaa", durationMs: 1000 },
  { trackId: "b", title: "B", artistName: "x", artworkUrl: null, youtubeVideoId: "bbbbbbbbbbb", durationMs: 1000 },
];

describe("playback queue", () => {
  it("advances next/previous and repeats", () => {
    let state = createQueue(items, 0);
    expect(currentItem(state)?.trackId).toBe("a");
    expect(nextIndex(state)).toBe(1);
    state = { ...state, index: 1 };
    expect(nextIndex(state)).toBeNull();
    state = { ...state, repeat: "all" };
    expect(nextIndex(state)).toBe(0);
    expect(previousIndex(state)).toBe(0);
    state = { ...state, repeat: "one" };
    expect(nextIndex(state)).toBe(1);
  });

  it("exposes clip bounds without spilling", () => {
    const clip = {
      ...items[0]!,
      clipStartMs: 10_000,
      clipEndMs: 40_000,
    };
    expect(clipBounds(clip)).toEqual({ startMs: 10_000, endMs: 40_000 });
    expect(clipBounds(items[0]!)).toBeNull();
  });

  it("keeps the current track first when shuffling", () => {
    const shuffled = shuffledCopy(items, 0);
    expect(shuffled[0]?.trackId).toBe("a");
    expect(shuffled).toHaveLength(2);
  });
});
