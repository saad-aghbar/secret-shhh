import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("music provider secrets", () => {
  it("never exposes YouTube or Spotify keys as NEXT_PUBLIC_", () => {
    const env = readFileSync(path.resolve(__dirname, "../env.ts"), "utf8");
    const example = readFileSync(path.resolve(__dirname, "../../../.env.example"), "utf8");
    expect(env).not.toMatch(/NEXT_PUBLIC_YOUTUBE/);
    expect(env).not.toMatch(/NEXT_PUBLIC_SPOTIFY/);
    expect(example).toMatch(/YOUTUBE_API_KEY=/);
    expect(example).toMatch(/SPOTIFY_CLIENT_ID=/);
    expect(example).not.toMatch(/NEXT_PUBLIC_YOUTUBE_API_KEY/);
    expect(example).not.toMatch(/NEXT_PUBLIC_SPOTIFY_CLIENT/);
  });
});
