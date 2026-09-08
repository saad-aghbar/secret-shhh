import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { authorizeConversationAccess, getConversationPartnerId } from "@/lib/chat/access";
import { getDb } from "@/lib/db";
import {
  musicActivity,
  musicFavorites,
  musicLibraryEntries,
  musicPlaylists,
  musicPlaylistTracks,
  musicRecommendations,
  musicSongOfMoment,
  musicTrackMemories,
  musicTracks,
  musicTrackSources,
} from "@/lib/db/schema";
import { MusicError } from "@/lib/music/errors";
import { detectVariantTag, normalizeArtist, normalizeTitle } from "@/lib/music/normalize";
import type { ResolvedMetadata } from "@/lib/music/providers/types";
import { isWeakArtistName } from "@/lib/music/providers/youtube";
import { broadcastConversationEvent } from "@/lib/realtime/broadcast";
import type {
  MusicActivityDto,
  MusicMemoryDto,
  MusicPlaylistDto,
  MusicRecommendationDto,
  MusicSourceDto,
  MusicTrackDto,
} from "@/lib/music/types";

export async function assertMusicMember(conversationId: string, userId: string) {
  if (!(await authorizeConversationAccess(userId, conversationId))) {
    throw new MusicError("FORBIDDEN", "You can’t do that.", 403);
  }
}

export function notifyMusicChanged(conversationId: string, extra: Record<string, string | null | undefined> = {}) {
  void broadcastConversationEvent(conversationId, "music:changed", extra);
}

type TrackRow = typeof musicTracks.$inferSelect;
type SourceRow = typeof musicTrackSources.$inferSelect;

export function serializeTrack(input: {
  track: TrackRow;
  sources: SourceRow[];
  viewerId: string;
  partnerId: string | null;
  personal: Set<string>;
  shared: Set<string>;
  partnerPersonal: Set<string>;
  favorites: Map<string, Set<string>>;
  songOfMomentId: string | null;
}): MusicTrackDto {
  const favoritedBy = input.favorites.get(input.track.id) ?? new Set();
  return {
    id: input.track.id,
    title: input.track.title,
    artistName: input.track.artistName,
    albumTitle: input.track.albumTitle,
    albumArtist: input.track.albumArtist,
    artworkUrl: input.track.artworkUrl,
    durationMs: input.track.durationMs,
    releaseYear: input.track.releaseYear,
    isrc: input.track.isrc,
    youtubeVideoId: input.track.youtubeVideoId,
    youtubePlayable: input.track.youtubePlayable,
    createdBy: input.track.createdBy,
    createdAt: input.track.createdAt.toISOString(),
    sources: input.sources.map(
      (source): MusicSourceDto => ({
        id: source.id,
        provider: source.provider,
        externalId: source.externalId,
        url: source.url,
        canonicalUrl: source.canonicalUrl,
      }),
    ),
    savedPersonal: input.personal.has(input.track.id),
    savedShared: input.shared.has(input.track.id),
    savedByPartner: input.partnerPersonal.has(input.track.id),
    favorited: favoritedBy.has(input.viewerId),
    partnerFavorited: Boolean(input.partnerId && favoritedBy.has(input.partnerId)),
    lovedByBoth: Boolean(input.partnerId && favoritedBy.has(input.viewerId) && favoritedBy.has(input.partnerId)),
    isSongOfMoment: input.songOfMomentId === input.track.id,
  };
}

export async function loadTrackContext(conversationId: string, viewerId: string, trackIds: string[]) {
  const partnerId = await getConversationPartnerId(conversationId, viewerId);
  if (trackIds.length === 0) {
    return {
      partnerId,
      sources: new Map<string, SourceRow[]>(),
      personal: new Set<string>(),
      shared: new Set<string>(),
      partnerPersonal: new Set<string>(),
      favorites: new Map<string, Set<string>>(),
      songOfMomentId: null as string | null,
    };
  }
  const db = getDb();
  const [sourceRows, libraryRows, favoriteRows, momentRow] = await Promise.all([
    db.select().from(musicTrackSources).where(inArray(musicTrackSources.trackId, trackIds)),
    db.select().from(musicLibraryEntries).where(inArray(musicLibraryEntries.trackId, trackIds)),
    db.select().from(musicFavorites).where(inArray(musicFavorites.trackId, trackIds)),
    db
      .select()
      .from(musicSongOfMoment)
      .where(and(eq(musicSongOfMoment.conversationId, conversationId), sql`${musicSongOfMoment.endedAt} is null`))
      .limit(1),
  ]);
  const sources = new Map<string, SourceRow[]>();
  for (const row of sourceRows) {
    const list = sources.get(row.trackId) ?? [];
    list.push(row);
    sources.set(row.trackId, list);
  }
  const personal = new Set<string>();
  const shared = new Set<string>();
  const partnerPersonal = new Set<string>();
  for (const row of libraryRows) {
    if (row.scope === "shared") shared.add(row.trackId);
    if (row.scope === "personal" && row.userId === viewerId) personal.add(row.trackId);
    if (row.scope === "personal" && partnerId && row.userId === partnerId) partnerPersonal.add(row.trackId);
  }
  const favorites = new Map<string, Set<string>>();
  for (const row of favoriteRows) {
    const set = favorites.get(row.trackId) ?? new Set();
    set.add(row.userId);
    favorites.set(row.trackId, set);
  }
  return {
    partnerId,
    sources,
    personal,
    shared,
    partnerPersonal,
    favorites,
    songOfMomentId: momentRow[0]?.trackId ?? null,
  };
}

export async function hydrateTracks(
  conversationId: string,
  viewerId: string,
  tracks: TrackRow[],
): Promise<MusicTrackDto[]> {
  const ctx = await loadTrackContext(
    conversationId,
    viewerId,
    tracks.map((track) => track.id),
  );
  return tracks.map((track) =>
    serializeTrack({
      track,
      sources: ctx.sources.get(track.id) ?? [],
      viewerId,
      partnerId: ctx.partnerId,
      personal: ctx.personal,
      shared: ctx.shared,
      partnerPersonal: ctx.partnerPersonal,
      favorites: ctx.favorites,
      songOfMomentId: ctx.songOfMomentId,
    }),
  );
}

export async function applyMetadataIfWeak(trackId: string, metadata: ResolvedMetadata) {
  const db = getDb();
  const existing = (
    await db.select().from(musicTracks).where(eq(musicTracks.id, trackId)).limit(1)
  )[0];
  if (!existing) return;
  const weakArtist = isWeakArtistName(existing.artistName) && !isWeakArtistName(metadata.artistName);
  if (!weakArtist) return;
  await db
    .update(musicTracks)
    .set({
      title: metadata.title,
      artistName: metadata.artistName,
      artworkUrl: metadata.artworkUrl ?? existing.artworkUrl,
      durationMs: metadata.durationMs ?? existing.durationMs,
      normalizedTitle: normalizeTitle(metadata.title),
      normalizedArtist: normalizeArtist(metadata.artistName),
      updatedAt: new Date(),
    })
    .where(eq(musicTracks.id, trackId));
}

export async function requireTrack(conversationId: string, trackId: string) {
  const db = getDb();
  const row = (
    await db
      .select()
      .from(musicTracks)
      .where(and(eq(musicTracks.id, trackId), eq(musicTracks.conversationId, conversationId)))
      .limit(1)
  )[0];
  if (!row) {
    throw new MusicError("NOT_FOUND", "That song isn’t here.", 404);
  }
  return row;
}

export async function writeActivity(input: {
  conversationId: string;
  kind: MusicActivityDto["kind"];
  actorId: string;
  trackId?: string | null;
  playlistId?: string | null;
  recommendationId?: string | null;
  dedupeKey: string;
}) {
  const db = getDb();
  await db
    .insert(musicActivity)
    .values({
      conversationId: input.conversationId,
      kind: input.kind,
      actorId: input.actorId,
      trackId: input.trackId ?? null,
      playlistId: input.playlistId ?? null,
      recommendationId: input.recommendationId ?? null,
      dedupeKey: input.dedupeKey,
    })
    .onConflictDoNothing({ target: musicActivity.dedupeKey });
}

export async function upsertCanonicalTrack(params: {
  conversationId: string;
  userId: string;
  metadata: ResolvedMetadata;
  existingTrackId?: string | null;
  youtubeVideoId?: string | null;
}) {
  const db = getDb();
  const youtubeVideoId = params.youtubeVideoId ?? params.metadata.youtubeVideoId;
  if (params.existingTrackId) {
    const existing = await requireTrack(params.conversationId, params.existingTrackId);
    await applyMetadataIfWeak(existing.id, params.metadata);
    await db
      .insert(musicTrackSources)
      .values({
        trackId: existing.id,
        provider: params.metadata.provider,
        externalId: params.metadata.externalId,
        url: params.metadata.url,
        canonicalUrl: params.metadata.canonicalUrl,
        metadataJson: {},
        addedBy: params.userId,
      })
      .onConflictDoNothing();
    if (youtubeVideoId && !existing.youtubeVideoId) {
      await db
        .update(musicTracks)
        .set({
          youtubeVideoId,
          youtubePlayable: true,
          updatedAt: new Date(),
        })
        .where(eq(musicTracks.id, existing.id));
    }
    if (youtubeVideoId) {
      await db
        .insert(musicTrackSources)
        .values({
          trackId: existing.id,
          provider: "youtube",
          externalId: youtubeVideoId,
          url: `https://www.youtube.com/watch?v=${youtubeVideoId}`,
          canonicalUrl: `https://www.youtube.com/watch?v=${youtubeVideoId}`,
          metadataJson: {},
          addedBy: params.userId,
        })
        .onConflictDoNothing();
    }
    return requireTrack(params.conversationId, existing.id);
  }

  const [created] = await db
    .insert(musicTracks)
    .values({
      conversationId: params.conversationId,
      title: params.metadata.title,
      artistName: params.metadata.artistName,
      albumTitle: params.metadata.albumTitle,
      albumArtist: params.metadata.albumArtist,
      artworkUrl: params.metadata.artworkUrl,
      durationMs: params.metadata.durationMs,
      releaseYear: params.metadata.releaseYear,
      isrc: params.metadata.isrc,
      normalizedTitle: normalizeTitle(params.metadata.title),
      normalizedArtist: normalizeArtist(params.metadata.artistName),
      variantTag: detectVariantTag(params.metadata.title, params.metadata.albumTitle ?? ""),
      youtubeVideoId,
      youtubePlayable: Boolean(youtubeVideoId),
      createdBy: params.userId,
    })
    .returning();
  if (!created) {
    throw new MusicError("UNAVAILABLE", "Couldn’t save that song.", 500);
  }
  await db.insert(musicTrackSources).values({
    trackId: created.id,
    provider: params.metadata.provider,
    externalId: params.metadata.externalId,
    url: params.metadata.url,
    canonicalUrl: params.metadata.canonicalUrl,
    metadataJson: {},
    addedBy: params.userId,
  });
  if (youtubeVideoId && params.metadata.provider !== "youtube" && params.metadata.provider !== "youtube_music") {
    await db
      .insert(musicTrackSources)
      .values({
        trackId: created.id,
        provider: "youtube",
        externalId: youtubeVideoId,
        url: `https://www.youtube.com/watch?v=${youtubeVideoId}`,
        canonicalUrl: `https://www.youtube.com/watch?v=${youtubeVideoId}`,
        metadataJson: {},
        addedBy: params.userId,
      })
      .onConflictDoNothing();
  }
  return created;
}

export async function setLibraryEntry(params: {
  conversationId: string;
  userId: string;
  trackId: string;
  scope: "personal" | "shared";
  saved: boolean;
}) {
  await assertMusicMember(params.conversationId, params.userId);
  await requireTrack(params.conversationId, params.trackId);
  const db = getDb();
  if (params.saved) {
    await db
      .insert(musicLibraryEntries)
      .values({
        trackId: params.trackId,
        userId: params.scope === "personal" ? params.userId : null,
        scope: params.scope,
      })
      .onConflictDoNothing();
    await writeActivity({
      conversationId: params.conversationId,
      kind: "added_library",
      actorId: params.userId,
      trackId: params.trackId,
      dedupeKey: `library:${params.scope}:${params.trackId}:${params.scope === "personal" ? params.userId : "shared"}`,
    });
  } else if (params.scope === "personal") {
    await db
      .delete(musicLibraryEntries)
      .where(
        and(
          eq(musicLibraryEntries.trackId, params.trackId),
          eq(musicLibraryEntries.scope, "personal"),
          eq(musicLibraryEntries.userId, params.userId),
        ),
      );
  } else {
    await db
      .delete(musicLibraryEntries)
      .where(and(eq(musicLibraryEntries.trackId, params.trackId), eq(musicLibraryEntries.scope, "shared")));
  }
  notifyMusicChanged(params.conversationId, { trackId: params.trackId, action: "library" });
}

export async function setFavorite(params: {
  conversationId: string;
  userId: string;
  trackId: string;
  favorited: boolean;
}) {
  await assertMusicMember(params.conversationId, params.userId);
  await requireTrack(params.conversationId, params.trackId);
  const db = getDb();
  if (params.favorited) {
    await db
      .insert(musicFavorites)
      .values({ trackId: params.trackId, userId: params.userId })
      .onConflictDoNothing();
    await writeActivity({
      conversationId: params.conversationId,
      kind: "loved",
      actorId: params.userId,
      trackId: params.trackId,
      dedupeKey: `loved:${params.trackId}:${params.userId}`,
    });
  } else {
    await db
      .delete(musicFavorites)
      .where(and(eq(musicFavorites.trackId, params.trackId), eq(musicFavorites.userId, params.userId)));
  }
  notifyMusicChanged(params.conversationId, { trackId: params.trackId, action: "favorite" });
}

export async function listActivity(conversationId: string, limit = 12): Promise<MusicActivityDto[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: musicActivity.id,
      kind: musicActivity.kind,
      actorId: musicActivity.actorId,
      trackId: musicActivity.trackId,
      playlistId: musicActivity.playlistId,
      createdAt: musicActivity.createdAt,
      trackTitle: musicTracks.title,
      playlistTitle: musicPlaylists.title,
    })
    .from(musicActivity)
    .leftJoin(musicTracks, eq(musicTracks.id, musicActivity.trackId))
    .leftJoin(musicPlaylists, eq(musicPlaylists.id, musicActivity.playlistId))
    .where(eq(musicActivity.conversationId, conversationId))
    .orderBy(desc(musicActivity.createdAt))
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    actorId: row.actorId,
    trackId: row.trackId,
    trackTitle: row.trackTitle,
    playlistId: row.playlistId,
    playlistTitle: row.playlistTitle,
    createdAt: row.createdAt.toISOString(),
  }));
}

export function serializePlaylist(row: typeof musicPlaylists.$inferSelect, trackCount: number, coverArtworkUrl: string | null): MusicPlaylistDto {
  return {
    id: row.id,
    title: row.title,
    note: row.note,
    ownerId: row.ownerId,
    collaborative: row.collaborative,
    coverArtworkUrl,
    trackCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeRecommendation(
  row: typeof musicRecommendations.$inferSelect,
  track: MusicTrackDto,
): MusicRecommendationDto {
  return {
    id: row.id,
    track,
    senderId: row.senderId,
    recipientId: row.recipientId,
    note: row.note,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    openedAt: row.openedAt?.toISOString() ?? null,
    listenedAt: row.listenedAt?.toISOString() ?? null,
    reactedAt: row.reactedAt?.toISOString() ?? null,
  };
}

export function serializeMemory(row: typeof musicTrackMemories.$inferSelect): MusicMemoryDto {
  return {
    id: row.id,
    trackId: row.trackId,
    authorId: row.authorId,
    text: row.text,
    createdAt: row.createdAt.toISOString(),
  };
}

export { musicPlaylistTracks, musicPlaylists, musicRecommendations, musicSongOfMoment, musicTrackMemories, musicTracks };
