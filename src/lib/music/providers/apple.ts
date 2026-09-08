import { providerFetchJson } from "@/lib/music/providers/fetch";
import type { ParsedMusicUrl } from "@/lib/music/providers/urls";
import type { ResolvedMetadata } from "@/lib/music/providers/types";

type ITunesResponse = {
  results?: Array<{
    wrapperType?: string;
    kind?: string;
    trackId?: number;
    collectionId?: number;
    trackName?: string;
    trackCensoredName?: string;
    artistName?: string;
    collectionName?: string;
    artworkUrl100?: string;
    artworkUrl600?: string;
    trackTimeMillis?: number;
    releaseDate?: string;
  }>;
};

function artworkLarge(url: string | undefined) {
  if (!url) return null;
  return url.replace(/\/\d+x\d+bb\./, "/600x600bb.");
}

export async function resolveAppleMetadata(parsed: ParsedMusicUrl): Promise<ResolvedMetadata> {
  if (!parsed.externalId) {
    throw new Error("unsupported_url");
  }
  const data = await providerFetchJson<ITunesResponse>({
    url: `https://itunes.apple.com/lookup?id=${encodeURIComponent(parsed.externalId)}`,
  });
  const track =
    data.results?.find((row) => row.kind === "song" || Boolean(row.trackName)) ?? data.results?.[0];
  if (!track?.trackName && !track?.collectionName) {
    throw new Error("couldnt_find");
  }
  const year = track.releaseDate?.slice(0, 4);
  return {
    provider: "apple_music",
    externalId: String(track.trackId ?? parsed.externalId),
    url: parsed.url,
    canonicalUrl: parsed.canonicalUrl,
    title: track.trackName ?? track.trackCensoredName ?? track.collectionName ?? "Unknown song",
    artistName: track.artistName ?? "Unknown artist",
    albumTitle: track.collectionName ?? null,
    albumArtist: track.artistName ?? null,
    artworkUrl: artworkLarge(track.artworkUrl600 ?? track.artworkUrl100),
    durationMs: typeof track.trackTimeMillis === "number" ? track.trackTimeMillis : null,
    releaseYear: year && /^\d{4}$/.test(year) ? Number(year) : null,
    isrc: null,
    youtubeVideoId: null,
  };
}
