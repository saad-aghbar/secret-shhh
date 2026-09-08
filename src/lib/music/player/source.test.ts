import { describe, expect, it } from "vitest";

import { clipBounds, createQueue, nextIndex } from "@/lib/music/player/queue";
import { isYouTubeVideoId } from "@/lib/music/providers/youtube-id";

describe("player source selection", () => {
  it("refuses invalid video ids instead of constructing an embed", () => {
    expect(isYouTubeVideoId("short")).toBe(false);
    expect(isYouTubeVideoId("dQw4w9WgXcQ")).toBe(true);
  });

  it("stops at clip end without advancing the queue", () => {
    const state = createQueue(
      [
        {
          trackId: "a",
          title: "A",
          artistName: "x",
          artworkUrl: null,
          youtubeVideoId: "dQw4w9WgXcQ",
          durationMs: 200_000,
          clipStartMs: 10_000,
          clipEndMs: 25_000,
        },
        {
          trackId: "b",
          title: "B",
          artistName: "x",
          artworkUrl: null,
          youtubeVideoId: "bbbbbbbbbbb",
          durationMs: 1000,
        },
      ],
      0,
    );
    expect(clipBounds(state.items[0]!)).toEqual({ startMs: 10_000, endMs: 25_000 });
    expect(nextIndex({ ...state, repeat: "none" })).toBe(1);
  });
});
