import { assertAllowedUserUrl } from "@/lib/music/providers/allowlist";
import { isYouTubeVideoId } from "@/lib/music/providers/youtube-id";

export type ParsedMusicUrl = {
  provider: "youtube" | "youtube_music" | "spotify" | "apple_music";
  externalId: string | null;
  url: string;
  canonicalUrl: string;
  kind: "track" | "video" | "album" | "unknown";
};

function cleanUrl(url: URL) {
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (key === "v" || key === "i" || key === "si" || key === "feature" || key === "list" || key === "index") {
      continue;
    }
    if (url.hostname.includes("youtube") && key === "v") continue;
    url.searchParams.delete(key);
  }
  return url;
}

function youtubeVideoIdFrom(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (host === "youtu.be" || host === "www.youtu.be") {
    const id = url.pathname.replace(/^\//, "").split("/")[0] ?? "";
    return isYouTubeVideoId(id) ? id : null;
  }
  if (url.pathname.startsWith("/watch")) {
    const id = url.searchParams.get("v") ?? "";
    return isYouTubeVideoId(id) ? id : null;
  }
  const embed = url.pathname.match(/^\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{11})/);
  if (embed?.[1] && isYouTubeVideoId(embed[1])) return embed[1];
  return null;
}

export function parseMusicUrl(raw: string): ParsedMusicUrl {
  const trimmed = raw.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("unsupported_url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("unsupported_scheme");
  }
  url.protocol = "https:";
  assertAllowedUserUrl(url);
  const host = url.hostname.toLowerCase();

  if (host.includes("youtu")) {
    const videoId = youtubeVideoIdFrom(url);
    if (!videoId) {
      throw new Error("unsupported_url");
    }
    const youtubeMusic = host.includes("music.youtube");
    return {
      provider: youtubeMusic ? "youtube_music" : "youtube",
      externalId: videoId,
      url: trimmed,
      canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      kind: "video",
    };
  }

  if (host === "open.spotify.com") {
    const match = url.pathname.match(/^\/(?:intl-[a-z]{2}\/)?(track|album|playlist)\/([A-Za-z0-9]+)/);
    if (!match || match[1] !== "track" || !match[2]) {
      throw new Error("unsupported_url");
    }
    const id = match[2];
    return {
      provider: "spotify",
      externalId: id,
      url: trimmed,
      canonicalUrl: `https://open.spotify.com/track/${id}`,
      kind: "track",
    };
  }

  if (host === "music.apple.com" || host === "itunes.apple.com") {
    const songId = url.searchParams.get("i");
    const pathMatch = url.pathname.match(/\/(song|album)\/[^/]+\/(\d+)/);
    const albumId = pathMatch?.[1] === "album" ? pathMatch[2] : pathMatch?.[1] === "song" ? pathMatch[2] : null;
    const id = songId ?? (pathMatch?.[1] === "song" ? pathMatch[2] : null);
    if (!id && !albumId) {
      throw new Error("unsupported_url");
    }
    const canonical = new URL(url.toString());
    canonical.hash = "";
    const cleaned = cleanUrl(canonical);
    return {
      provider: "apple_music",
      externalId: id ?? albumId,
      url: trimmed,
      canonicalUrl: cleaned.toString(),
      kind: id ? "track" : "album",
    };
  }

  throw new Error("unsupported_url");
}

export function tryParseMusicUrl(raw: string): ParsedMusicUrl | null {
  try {
    return parseMusicUrl(raw);
  } catch {
    return null;
  }
}

export function extractSupportedMusicUrl(text: string): ParsedMusicUrl | null {
  const match = text.match(/https?:\/\/[^\s]+/i);
  if (!match) return null;
  return tryParseMusicUrl(match[0].replace(/[),.;]+$/, ""));
}
