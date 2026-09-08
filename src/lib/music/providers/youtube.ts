import { getMusicEnv } from "@/lib/music/env";
import { providerFetchJson } from "@/lib/music/providers/fetch";
import type { ParsedMusicUrl } from "@/lib/music/providers/urls";
import type { ResolvedMetadata, YouTubeSearchHit } from "@/lib/music/providers/types";
import { isYouTubeVideoId } from "@/lib/music/providers/youtube-id";

type OEmbed = {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
};

type YouTubeSearchResponse = {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      channelTitle?: string;
      thumbnails?: { high?: { url?: string }; medium?: { url?: string }; default?: { url?: string } };
    };
  }>;
};

type YouTubeVideosResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      channelTitle?: string;
      thumbnails?: { high?: { url?: string }; medium?: { url?: string } };
    };
    contentDetails?: { duration?: string };
  }>;
};

function parseIsoDuration(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return ((hours * 60 + minutes) * 60 + seconds) * 1000;
}

export const UNKNOWN_ARTIST = "Unknown artist";

export function isWeakArtistName(name: string | null | undefined) {
  return !name?.trim() || name.trim() === UNKNOWN_ARTIST;
}

export function splitTitleArtist(title: string, channel: string) {
  const cleanedChannel = channel.replace(/\s*-\s*Topic$/i, "").replace(/VEVO$/i, "").trim();
  const parts = title.split(/\s[-–—]\s/);
  if (parts.length >= 2) {
    const artistName = parts[0]!.trim();
    const rest = parts.slice(1).join(" - ").trim();
    if (artistName && rest) return { artistName, title: rest };
  }
  return { artistName: cleanedChannel || UNKNOWN_ARTIST, title };
}

export async function resolveYouTubeMetadata(parsed: ParsedMusicUrl): Promise<ResolvedMetadata> {
  const videoId = parsed.externalId;
  if (!videoId || !isYouTubeVideoId(videoId)) {
    throw new Error("unsupported_url");
  }
  const env = getMusicEnv();
  if (env.YOUTUBE_API_KEY) {
    const data = await providerFetchJson<YouTubeVideosResponse>({
      url: `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(env.YOUTUBE_API_KEY)}`,
    });
    const item = data.items?.[0];
    if (item?.snippet?.title) {
      const split = splitTitleArtist(item.snippet.title, item.snippet.channelTitle ?? "");
      return {
        provider: parsed.provider,
        externalId: videoId,
        url: parsed.url,
        canonicalUrl: parsed.canonicalUrl,
        title: split.title,
        artistName: split.artistName,
        albumTitle: null,
        albumArtist: null,
        artworkUrl: item.snippet.thumbnails?.high?.url ?? item.snippet.thumbnails?.medium?.url ?? null,
        durationMs: parseIsoDuration(item.contentDetails?.duration),
        releaseYear: null,
        isrc: null,
        youtubeVideoId: videoId,
      };
    }
  }

  const oembed = await providerFetchJson<OEmbed>({
    url: `https://www.youtube.com/oembed?url=${encodeURIComponent(parsed.canonicalUrl)}&format=json`,
  });
  if (!oembed.title) {
    throw new Error("couldnt_find");
  }
  const split = splitTitleArtist(oembed.title, oembed.author_name ?? "");
  return {
    provider: parsed.provider,
    externalId: videoId,
    url: parsed.url,
    canonicalUrl: parsed.canonicalUrl,
    title: split.title,
    artistName: split.artistName,
    albumTitle: null,
    albumArtist: null,
    artworkUrl: oembed.thumbnail_url ?? null,
    durationMs: null,
    releaseYear: null,
    isrc: null,
    youtubeVideoId: videoId,
  };
}

export async function searchYouTubeVideos(query: string, limit = 5): Promise<YouTubeSearchHit[]> {
  const env = getMusicEnv();
  if (!env.YOUTUBE_API_KEY) return [];
  const data = await providerFetchJson<YouTubeSearchResponse>({
    url: `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${Math.min(8, Math.max(1, limit))}&q=${encodeURIComponent(query)}&key=${encodeURIComponent(env.YOUTUBE_API_KEY)}`,
  });
  const ids = (data.items ?? [])
    .map((item) => item.id?.videoId)
    .filter((id): id is string => Boolean(id && isYouTubeVideoId(id)));
  if (ids.length === 0) return [];
  const details = await providerFetchJson<YouTubeVideosResponse>({
    url: `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${ids.map(encodeURIComponent).join(",")}&key=${encodeURIComponent(env.YOUTUBE_API_KEY)}`,
  });
  return (details.items ?? []).flatMap((item) => {
    const videoId = item.id;
    if (!videoId || !isYouTubeVideoId(videoId) || !item.snippet?.title) return [];
    return [
      {
        videoId,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle ?? "",
        durationMs: parseIsoDuration(item.contentDetails?.duration),
        artworkUrl: item.snippet.thumbnails?.high?.url ?? item.snippet.thumbnails?.medium?.url ?? null,
      },
    ];
  });
}
