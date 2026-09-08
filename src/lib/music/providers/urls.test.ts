import { describe, expect, it } from "vitest";

import { parseMusicUrl, tryParseMusicUrl } from "@/lib/music/providers/urls";
import { isAllowedApiHost, isAllowedUserHost } from "@/lib/music/providers/allowlist";
import { isYouTubeVideoId } from "@/lib/music/providers/youtube-id";

describe("music URL parsers", () => {
  it("parses YouTube watch, short, embed, and music URLs", () => {
    expect(parseMusicUrl("https://www.youtube.com/watch?v=dQw4w9wgXcQ").externalId).toBe("dQw4w9wgXcQ");
    expect(parseMusicUrl("https://youtu.be/dQw4w9wgXcQ").canonicalUrl).toBe(
      "https://www.youtube.com/watch?v=dQw4w9wgXcQ",
    );
    expect(parseMusicUrl("https://www.youtube.com/embed/dQw4w9wgXcQ").provider).toBe("youtube");
    expect(parseMusicUrl("https://music.youtube.com/watch?v=dQw4w9wgXcQ").provider).toBe("youtube_music");
  });

  it("parses Spotify track links and rejects playlists", () => {
    expect(parseMusicUrl("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=abc").canonicalUrl).toBe(
      "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
    );
    expect(() => parseMusicUrl("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M")).toThrow(
      "unsupported_url",
    );
  });

  it("parses Apple Music song links", () => {
    const parsed = parseMusicUrl("https://music.apple.com/us/album/never-gonna-give-you-up/1559563319?i=1559563516");
    expect(parsed.provider).toBe("apple_music");
    expect(parsed.externalId).toBe("1559563516");
  });

  it("rejects unsupported schemes, hosts, and junk", () => {
    expect(() => parseMusicUrl("ftp://youtube.com/watch?v=dQw4w9wgXcQ")).toThrow("unsupported_scheme");
    expect(() => parseMusicUrl("javascript:alert(1)")).toThrow("unsupported_scheme");
    expect(() => parseMusicUrl("data:text/html,hi")).toThrow("unsupported_scheme");
    expect(() => parseMusicUrl("file:///etc/passwd")).toThrow("unsupported_scheme");
    expect(() => parseMusicUrl("https://evil.example/watch?v=dQw4w9wgXcQ")).toThrow("unsupported_host");
    expect(tryParseMusicUrl("not a url")).toBeNull();
  });
});

describe("SSRF allowlist", () => {
  it("allows provider hosts and blocks private addresses", () => {
    expect(isAllowedUserHost("open.spotify.com")).toBe(true);
    expect(isAllowedUserHost("music.apple.com")).toBe(true);
    expect(isAllowedUserHost("127.0.0.1")).toBe(false);
    expect(isAllowedUserHost("10.0.0.4")).toBe(false);
    expect(isAllowedUserHost("169.254.169.254")).toBe(false);
    expect(isAllowedUserHost("localhost")).toBe(false);
    expect(isAllowedUserHost("0.0.0.0")).toBe(false);
    expect(isAllowedApiHost("www.googleapis.com")).toBe(true);
    expect(isAllowedApiHost("api.spotify.com")).toBe(true);
    expect(isAllowedApiHost("192.168.1.9")).toBe(false);
  });
});

describe("youtube id", () => {
  it("accepts only 11-character ids", () => {
    expect(isYouTubeVideoId("dQw4w9wgXcQ")).toBe(true);
    expect(isYouTubeVideoId("short")).toBe(false);
    expect(isYouTubeVideoId("https://youtube.com")).toBe(false);
  });
});
