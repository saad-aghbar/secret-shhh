/**
 * Real provider resolution smoke. Prints titles only — never secrets.
 *
 *   pnpm music:smoke
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { resolveAppleMetadata } from "../src/lib/music/providers/apple";
import { resolveSpotifyMetadata } from "../src/lib/music/providers/spotify";
import { parseMusicUrl } from "../src/lib/music/providers/urls";
import { resolveYouTubeMetadata } from "../src/lib/music/providers/youtube";

const YOUTUBE = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const SPOTIFY = "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC";
const APPLE = "https://music.apple.com/us/album/never-gonna-give-you-up/1773292758?i=1773293184";

function applyEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq);
    let value = line.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function assertNoSecrets(text: string) {
  const envKeys = [
    process.env.YOUTUBE_API_KEY,
    process.env.SPOTIFY_CLIENT_ID,
    process.env.SPOTIFY_CLIENT_SECRET,
  ].filter(Boolean) as string[];
  for (const key of envKeys) {
    if (key && text.includes(key)) {
      throw new Error("Refusing to print a provider secret.");
    }
  }
}

async function main() {
  applyEnvLocal();
  const results: string[] = [];
  for (const [label, url, resolve] of [
    ["YouTube", YOUTUBE, resolveYouTubeMetadata],
    ["Spotify", SPOTIFY, resolveSpotifyMetadata],
    ["Apple", APPLE, resolveAppleMetadata],
  ] as const) {
    try {
      const parsed = parseMusicUrl(url);
      const metadata = await resolve(parsed);
      results.push(`${label}: ${metadata.title} — ${metadata.artistName}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "failed";
      assertNoSecrets(reason);
      results.push(`${label}: FAILED (${reason})`);
    }
  }
  const line = results.join("\n");
  assertNoSecrets(line);
  console.log(line);
  if (results.some((row) => row.includes("FAILED"))) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "music smoke failed");
  process.exit(1);
});
