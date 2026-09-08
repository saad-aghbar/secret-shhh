import { describe, expect, it } from "vitest";

import { shouldReuseCanonical } from "@/lib/music/canonical";
import type { CanonicalCandidate } from "@/lib/music/canonical";
import { detectVariantTag, normalizeArtist, normalizeTitle } from "@/lib/music/normalize";
import { rankYouTubeMatches } from "@/lib/music/providers/match";

const studio: CanonicalCandidate = {
  id: "studio",
  normalizedTitle: normalizeTitle("Never Gonna Give You Up"),
  normalizedArtist: normalizeArtist("Rick Astley"),
  variantTag: "studio",
  durationMs: 213_000,
  isrc: "GBARL9300135",
  youtubeVideoId: "dQw4w9wgXcQ",
  providerIds: [{ provider: "spotify", externalId: "4cOdK2wGLETkXr3Xq1v5hA" }],
};

describe("canonical reuse", () => {
  it("reuses the same recording across Spotify and Apple", () => {
    expect(
      shouldReuseCanonical({
        title: "Never Gonna Give You Up",
        artistName: "Rick Astley",
        durationMs: 213_400,
        isrc: "GBARL9300135",
        youtubeVideoId: null,
        provider: "apple_music",
        externalId: "1559563516",
        candidates: [studio],
      }),
    ).toBe("studio");
  });

  it("reuses YouTube + Spotify as one track", () => {
    expect(
      shouldReuseCanonical({
        title: "Never Gonna Give You Up",
        artistName: "Rick Astley",
        durationMs: 213_000,
        isrc: null,
        youtubeVideoId: "dQw4w9wgXcQ",
        provider: "youtube",
        externalId: "dQw4w9wgXcQ",
        candidates: [studio],
      }),
    ).toBe("studio");
  });

  it("keeps live, cover, remaster, and different artists separate", () => {
    expect(
      shouldReuseCanonical({
        title: "Never Gonna Give You Up (Live)",
        artistName: "Rick Astley",
        durationMs: 240_000,
        isrc: null,
        youtubeVideoId: null,
        provider: "youtube",
        externalId: "live1111111",
        candidates: [studio],
      }),
    ).toBeNull();
    expect(
      shouldReuseCanonical({
        title: "Never Gonna Give You Up",
        artistName: "Someone Else",
        durationMs: 213_000,
        isrc: null,
        youtubeVideoId: null,
        provider: "spotify",
        externalId: "other",
        candidates: [studio],
      }),
    ).toBeNull();
    expect(detectVariantTag("Yellow (Cover)")).toBe("cover");
    expect(detectVariantTag("Yellow (Remastered 2024)")).toBe("remaster");
  });
});

describe("youtube match confidence", () => {
  it("does not silently pick karaoke or covers", () => {
    const ranked = rankYouTubeMatches({
      title: "Yellow",
      artistName: "Coldplay",
      durationMs: 269_000,
      hits: [
        {
          videoId: "karaoke11111",
          title: "Yellow KARAOKE",
          channelTitle: "Karaoke Hits",
          durationMs: 270_000,
          artworkUrl: null,
        },
        {
          videoId: "cover2222222",
          title: "Yellow cover",
          channelTitle: "Bedroom Covers",
          durationMs: 260_000,
          artworkUrl: null,
        },
      ],
    });
    expect(ranked.confidence).not.toBe("confident");
  });

  it("is confident for an official topic match", () => {
    const ranked = rankYouTubeMatches({
      title: "Yellow",
      artistName: "Coldplay",
      durationMs: 269_000,
      hits: [
        {
          videoId: "official111",
          title: "Yellow",
          channelTitle: "Coldplay - Topic",
          durationMs: 269_000,
          artworkUrl: null,
        },
      ],
    });
    expect(ranked.confidence).toBe("confident");
    expect(ranked.ranked[0]?.videoId).toBe("official111");
  });
});
