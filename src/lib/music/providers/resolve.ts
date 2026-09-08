import { and, eq, inArray, sql } from "drizzle-orm";

import { MusicError } from "@/lib/music/errors";
import { detectVariantTag, durationClose, normalizeArtist, normalizeTitle } from "@/lib/music/normalize";
import { readProviderCache, writeProviderCache } from "@/lib/music/providers/cache";
import { resolveAppleMetadata } from "@/lib/music/providers/apple";
import { rankYouTubeMatches } from "@/lib/music/providers/match";
import { resolveSpotifyMetadata } from "@/lib/music/providers/spotify";
import type { ParsedMusicUrl } from "@/lib/music/providers/urls";
import { parseMusicUrl } from "@/lib/music/providers/urls";
import type { ResolvePreview, ResolvedMetadata, YouTubeSearchHit } from "@/lib/music/providers/types";
import { isWeakArtistName, resolveYouTubeMetadata, searchYouTubeVideos } from "@/lib/music/providers/youtube";
import { getDb } from "@/lib/db";
import { musicTrackSources, musicTracks } from "@/lib/db/schema";
import { assertMusicProviderAllowed } from "@/lib/music/rate-limit";
import { applyMetadataIfWeak } from "@/lib/music/store";

export type { ResolvePreview };

function mapResolveError(error: unknown): never {
  const message = error instanceof Error ? error.message : "";
  if (message === "unsupported_scheme" || message === "unsupported_host" || message === "unsupported_url") {
    throw new MusicError("VALIDATION_ERROR", "Try another link.", 400);
  }
  if (message === "couldnt_find") {
    throw new MusicError("NOT_FOUND", "Couldn’t find that song.", 404);
  }
  if (error instanceof MusicError) throw error;
  throw new MusicError("UNAVAILABLE", "Couldn’t find that song.", 503);
}

function youtubeFamily(provider: ParsedMusicUrl["provider"]) {
  return provider === "youtube" || provider === "youtube_music"
    ? (["youtube", "youtube_music"] as const)
    : ([provider] as const);
}

async function findTrackByParsedUrl(conversationId: string, parsed: ParsedMusicUrl) {
  const db = getDb();
  const providers = [...youtubeFamily(parsed.provider)];
  if (parsed.externalId) {
    const bySource = (
      await db
        .select({ track: musicTracks })
        .from(musicTrackSources)
        .innerJoin(musicTracks, eq(musicTracks.id, musicTrackSources.trackId))
        .where(
          and(
            eq(musicTracks.conversationId, conversationId),
            inArray(musicTrackSources.provider, providers),
            eq(musicTrackSources.externalId, parsed.externalId),
          ),
        )
        .limit(1)
    )[0];
    if (bySource) return bySource.track;
  }
  const byUrl = (
    await db
      .select({ track: musicTracks })
      .from(musicTrackSources)
      .innerJoin(musicTracks, eq(musicTracks.id, musicTrackSources.trackId))
      .where(
        and(eq(musicTracks.conversationId, conversationId), eq(musicTrackSources.canonicalUrl, parsed.canonicalUrl)),
      )
      .limit(1)
  )[0];
  if (byUrl) return byUrl.track;
  if (parsed.externalId && (parsed.provider === "youtube" || parsed.provider === "youtube_music")) {
    const byVideo = (
      await db
        .select()
        .from(musicTracks)
        .where(and(eq(musicTracks.conversationId, conversationId), eq(musicTracks.youtubeVideoId, parsed.externalId)))
        .limit(1)
    )[0];
    if (byVideo) return byVideo;
  }
  return null;
}

function previewFromExisting(parsed: ParsedMusicUrl, track: typeof musicTracks.$inferSelect): ResolvePreview {
  return {
    metadata: {
      provider: parsed.provider,
      externalId: parsed.externalId,
      url: parsed.url,
      canonicalUrl: parsed.canonicalUrl,
      title: track.title,
      artistName: track.artistName,
      albumTitle: track.albumTitle,
      albumArtist: track.albumArtist,
      artworkUrl: track.artworkUrl,
      durationMs: track.durationMs,
      releaseYear: track.releaseYear,
      isrc: track.isrc,
      youtubeVideoId: track.youtubeVideoId,
    },
    existingTrackId: track.id,
    match: {
      confidence: track.youtubeVideoId ? "confident" : "none",
      candidates: [],
      selectedVideoId: track.youtubeVideoId,
    },
  };
}

export async function resolveProviderMetadata(
  parsed: ParsedMusicUrl,
  userId?: string,
): Promise<ResolvedMetadata> {
  const cacheKey = `resolve:${parsed.provider}:${parsed.canonicalUrl}`;
  const cached = await readProviderCache<ResolvedMetadata>(cacheKey);
  if (cached?.title) return cached;
  if (userId) await assertMusicProviderAllowed(userId, "resolve");
  try {
    const metadata =
      parsed.provider === "spotify"
        ? await resolveSpotifyMetadata(parsed)
        : parsed.provider === "apple_music"
          ? await resolveAppleMetadata(parsed)
          : await resolveYouTubeMetadata(parsed);
    await writeProviderCache({
      key: cacheKey,
      provider: parsed.provider,
      payload: metadata as Record<string, unknown>,
    });
    return metadata;
  } catch (error) {
    mapResolveError(error);
  }
}

export async function findExistingTrack(params: {
  conversationId: string;
  metadata: ResolvedMetadata;
}): Promise<string | null> {
  const db = getDb();
  if (params.metadata.externalId) {
    const bySource = (
      await db
        .select({ trackId: musicTrackSources.trackId })
        .from(musicTrackSources)
        .innerJoin(musicTracks, eq(musicTracks.id, musicTrackSources.trackId))
        .where(
          and(
            eq(musicTracks.conversationId, params.conversationId),
            eq(musicTrackSources.provider, params.metadata.provider),
            eq(musicTrackSources.externalId, params.metadata.externalId),
          ),
        )
        .limit(1)
    )[0];
    if (bySource) return bySource.trackId;
  }
  if (params.metadata.isrc) {
    const byIsrc = (
      await db
        .select({ id: musicTracks.id })
        .from(musicTracks)
        .where(and(eq(musicTracks.conversationId, params.conversationId), eq(musicTracks.isrc, params.metadata.isrc)))
        .limit(1)
    )[0];
    if (byIsrc) return byIsrc.id;
  }
  if (params.metadata.youtubeVideoId) {
    const byYt = (
      await db
        .select({ id: musicTracks.id })
        .from(musicTracks)
        .where(
          and(
            eq(musicTracks.conversationId, params.conversationId),
            eq(musicTracks.youtubeVideoId, params.metadata.youtubeVideoId),
          ),
        )
        .limit(1)
    )[0];
    if (byYt) return byYt.id;
  }
  const title = normalizeTitle(params.metadata.title);
  const artist = normalizeArtist(params.metadata.artistName);
  const variant = detectVariantTag(params.metadata.title, params.metadata.albumTitle ?? "");
  const candidates = await db
    .select()
    .from(musicTracks)
    .where(
      and(
        eq(musicTracks.conversationId, params.conversationId),
        eq(musicTracks.normalizedTitle, title),
        eq(musicTracks.normalizedArtist, artist),
      ),
    );
  const match = candidates.find(
    (row) =>
      row.variantTag === variant &&
      (params.metadata.durationMs == null ||
        row.durationMs == null ||
        durationClose(row.durationMs, params.metadata.durationMs)),
  );
  return match?.id ?? null;
}

export async function resolveMusicUrl(params: {
  conversationId: string;
  url: string;
  userId?: string;
}): Promise<ResolvePreview> {
  let parsed: ParsedMusicUrl;
  try {
    parsed = parseMusicUrl(params.url);
  } catch (error) {
    mapResolveError(error);
  }
  const existingRow = await findTrackByParsedUrl(params.conversationId, parsed);
  if (existingRow && !isWeakArtistName(existingRow.artistName)) {
    return previewFromExisting(parsed, existingRow);
  }
  const metadata = await resolveProviderMetadata(parsed, params.userId);
  if (existingRow) {
    await applyMetadataIfWeak(existingRow.id, metadata);
    const refreshed = (await getDb().select().from(musicTracks).where(eq(musicTracks.id, existingRow.id)).limit(1))[0];
    return previewFromExisting(parsed, refreshed ?? existingRow);
  }
  const existingTrackId = await findExistingTrack({
    conversationId: params.conversationId,
    metadata,
  });
  let candidates: YouTubeSearchHit[] = [];
  let confidence: "confident" | "ambiguous" | "none" = metadata.youtubeVideoId ? "confident" : "none";
  let selectedVideoId = metadata.youtubeVideoId;
  if (!selectedVideoId) {
    const query = `${metadata.artistName} ${metadata.title} official audio`;
    candidates = await searchYouTubeVideos(query, 6);
    const ranked = rankYouTubeMatches({
      title: metadata.title,
      artistName: metadata.artistName,
      durationMs: metadata.durationMs,
      hits: candidates,
    });
    confidence = ranked.confidence;
    candidates = ranked.ranked;
    if (ranked.confidence === "confident") {
      selectedVideoId = ranked.ranked[0]?.videoId ?? null;
    }
  }
  return {
    metadata: { ...metadata, youtubeVideoId: selectedVideoId },
    existingTrackId,
    match: { confidence, candidates, selectedVideoId },
  };
}

export async function repairWeakYouTubeArtists(conversationId: string) {
  const db = getDb();
  const weak = await db
    .select()
    .from(musicTracks)
    .where(and(eq(musicTracks.conversationId, conversationId), eq(musicTracks.artistName, "Unknown artist")))
    .limit(8);
  for (const track of weak) {
    if (track.youtubeVideoId) {
      try {
        const parsed = parseMusicUrl(`https://www.youtube.com/watch?v=${track.youtubeVideoId}`);
        const metadata = await resolveYouTubeMetadata(parsed);
        await applyMetadataIfWeak(track.id, metadata);
        continue;
      } catch {
        /* try a sibling with the same title */
      }
    }
    const sibling = (
      await db
        .select()
        .from(musicTracks)
        .where(
          and(
            eq(musicTracks.conversationId, conversationId),
            eq(musicTracks.normalizedTitle, track.normalizedTitle),
            sql`${musicTracks.artistName} <> 'Unknown artist'`,
          ),
        )
        .limit(1)
    )[0];
    if (!sibling) continue;
    await applyMetadataIfWeak(track.id, {
      provider: "youtube",
      externalId: sibling.youtubeVideoId,
      url: sibling.youtubeVideoId ? `https://www.youtube.com/watch?v=${sibling.youtubeVideoId}` : "",
      canonicalUrl: sibling.youtubeVideoId ? `https://www.youtube.com/watch?v=${sibling.youtubeVideoId}` : "",
      title: track.title,
      artistName: sibling.artistName,
      albumTitle: sibling.albumTitle,
      albumArtist: sibling.albumArtist,
      artworkUrl: track.artworkUrl ?? sibling.artworkUrl,
      durationMs: track.durationMs ?? sibling.durationMs,
      releaseYear: sibling.releaseYear,
      isrc: track.isrc ?? sibling.isrc,
      youtubeVideoId: track.youtubeVideoId ?? sibling.youtubeVideoId,
    });
  }
}
