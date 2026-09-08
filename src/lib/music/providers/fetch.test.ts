import { describe, expect, it } from "vitest";

import { assertAllowedApiUrl } from "@/lib/music/providers/allowlist";
import { youtubeEmbedUrl } from "@/lib/music/providers/youtube-id";

describe("provider fetch URL policy", () => {
  it("requires https and an allowlisted host before any outbound request", () => {
    expect(() => assertAllowedApiUrl(new URL("http://api.spotify.com/v1/tracks/x"))).toThrow(
      "unsupported_scheme",
    );
    expect(() => assertAllowedApiUrl(new URL("https://127.0.0.1/secret"))).toThrow("unsupported_host");
    expect(() => assertAllowedApiUrl(new URL("https://evil.example/oembed"))).toThrow("unsupported_host");
    expect(() => assertAllowedApiUrl(new URL("https://www.googleapis.com/youtube/v3/videos"))).not.toThrow();
  });
});

describe("youtube embed construction", () => {
  it("builds embed URLs internally from a validated id", () => {
    expect(youtubeEmbedUrl("dQw4w9WgXcQ", "https://shhh.example")).toContain(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
    expect(() => youtubeEmbedUrl("not-an-id", "https://shhh.example")).toThrow("invalid_youtube_id");
  });
});
