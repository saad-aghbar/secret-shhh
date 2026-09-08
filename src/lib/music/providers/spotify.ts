import { getMusicEnv, hasSpotifyCredentials } from "@/lib/music/env";
import { providerFetchJson } from "@/lib/music/providers/fetch";
import type { ParsedMusicUrl } from "@/lib/music/providers/urls";
import type { ResolvedMetadata } from "@/lib/music/providers/types";

type TokenResponse = { access_token?: string; expires_in?: number };
type OEmbed = { title?: string; thumbnail_url?: string };
type SpotifyTrack = {
  id?: string;
  name?: string;
  duration_ms?: number;
  album?: {
    name?: string;
    images?: Array<{ url?: string }>;
    release_date?: string;
    artists?: Array<{ name?: string }>;
  };
  artists?: Array<{ name?: string }>;
  external_ids?: { isrc?: string };
};

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 15_000) {
    return cachedToken.value;
  }
  const env = getMusicEnv();
  if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) {
    return null;
  }
  const basic = Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const data = await providerFetchJson<TokenResponse>({
    url: "https://accounts.spotify.com/api/token",
    method: "POST",
    headers: {
      authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!data.access_token) return null;
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return data.access_token;
}

export function resetSpotifyTokenCache() {
  cachedToken = null;
}

export async function resolveSpotifyMetadata(parsed: ParsedMusicUrl): Promise<ResolvedMetadata> {
  if (hasSpotifyCredentials()) {
    const token = await getAccessToken();
    if (token && parsed.externalId) {
      const track = await providerFetchJson<SpotifyTrack>({
        url: `https://api.spotify.com/v1/tracks/${encodeURIComponent(parsed.externalId)}`,
        headers: { authorization: `Bearer ${token}` },
      });
      if (track.name) {
        const year = track.album?.release_date?.slice(0, 4);
        return {
          provider: "spotify",
          externalId: parsed.externalId,
          url: parsed.url,
          canonicalUrl: parsed.canonicalUrl,
          title: track.name,
          artistName: track.artists?.map((artist) => artist.name).filter(Boolean).join(", ") || "Unknown artist",
          albumTitle: track.album?.name ?? null,
          albumArtist: track.album?.artists?.[0]?.name ?? null,
          artworkUrl: track.album?.images?.[0]?.url ?? null,
          durationMs: typeof track.duration_ms === "number" ? track.duration_ms : null,
          releaseYear: year && /^\d{4}$/.test(year) ? Number(year) : null,
          isrc: track.external_ids?.isrc ?? null,
          youtubeVideoId: null,
        };
      }
    }
  }

  const oembed = await providerFetchJson<OEmbed>({
    url: `https://open.spotify.com/oembed?url=${encodeURIComponent(parsed.canonicalUrl)}`,
  });
  if (!oembed.title) {
    throw new Error("couldnt_find");
  }
  const parts = oembed.title.split(/\s[-–—]\s/);
  return {
    provider: "spotify",
    externalId: parsed.externalId,
    url: parsed.url,
    canonicalUrl: parsed.canonicalUrl,
    title: parts.length >= 2 ? parts.slice(0, -1).join(" - ").trim() : oembed.title,
    artistName: parts.length >= 2 ? parts.at(-1)!.trim() : "Unknown artist",
    albumTitle: null,
    albumArtist: null,
    artworkUrl: oembed.thumbnail_url ?? null,
    durationMs: null,
    releaseYear: null,
    isrc: null,
    youtubeVideoId: null,
  };
}
