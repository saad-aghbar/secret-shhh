import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";

import { getConversationPartnerId } from "@/lib/chat/access";
import { getDb } from "@/lib/db";
import {
  musicPlaylists,
  musicPlaylistTracks,
  musicRecommendations,
  musicRecentlyPlayed,
  musicSongOfMoment,
  musicTrackMemories,
  musicTracks,
  musicTrackSources,
} from "@/lib/db/schema";
import { MusicError } from "@/lib/music/errors";
import { hasYouTubeSearch } from "@/lib/music/env";
import { resolveMusicUrl, repairWeakYouTubeArtists } from "@/lib/music/providers/resolve";
import { searchYouTubeVideos } from "@/lib/music/providers/youtube";
import { isYouTubeVideoId } from "@/lib/music/providers/youtube-id";
import {
  assertMusicMember,
  hydrateTracks,
  listActivity,
  notifyMusicChanged,
  requireTrack,
  serializeMemory,
  serializePlaylist,
  serializeRecommendation,
  setFavorite,
  setLibraryEntry,
  upsertCanonicalTrack,
  writeActivity,
} from "@/lib/music/store";
import type {
  MusicAlbumGroupDto,
  MusicArtistGroupDto,
  MusicHomeDto,
  MusicMemoryDto,
  MusicPlaylistDetailDto,
  MusicPlaylistDto,
  MusicRecommendationDto,
  MusicSongOfMomentDto,
} from "@/lib/music/types";

export { setFavorite, setLibraryEntry };

export async function getMusicHome(conversationId: string, userId: string): Promise<MusicHomeDto> {
  await assertMusicMember(conversationId, userId);
  await repairWeakYouTubeArtists(conversationId);
  const db = getDb();
  const [tracks, playlists, recommendations, activity, moment] = await Promise.all([
    db.select().from(musicTracks).where(eq(musicTracks.conversationId, conversationId)).orderBy(desc(musicTracks.createdAt)).limit(200),
    listPlaylists(conversationId, userId),
    db
      .select()
      .from(musicRecommendations)
      .where(eq(musicRecommendations.conversationId, conversationId))
      .orderBy(desc(musicRecommendations.createdAt))
      .limit(40),
    listActivity(conversationId, 8),
    db
      .select()
      .from(musicSongOfMoment)
      .where(and(eq(musicSongOfMoment.conversationId, conversationId), sql`${musicSongOfMoment.endedAt} is null`))
      .limit(1),
  ]);
  const hydrated = await hydrateTracks(conversationId, userId, tracks);
  const byId = new Map(hydrated.map((track) => [track.id, track]));
  const recs: MusicRecommendationDto[] = recommendations.flatMap((row) => {
    const track = byId.get(row.trackId);
    if (!track) return [];
    return [serializeRecommendation(row, track)];
  });
  const momentTrack = moment[0] ? byId.get(moment[0].trackId) : null;
  return {
    songOfMoment:
      moment[0] && momentTrack
        ? {
            id: moment[0].id,
            track: momentTrack,
            setBy: moment[0].setBy,
            startedAt: moment[0].startedAt.toISOString(),
            endedAt: null,
          }
        : null,
    forYou: recs
      .filter((row) => row.recipientId === userId)
      .sort((a, b) => {
        const order = (status: string) => (status === "pending" || status === "opened" ? 0 : 1);
        return order(a.status) - order(b.status);
      }),
    sentByMe: recs.filter((row) => row.senderId === userId),
    ourSongs: hydrated.filter((track) => track.savedShared),
    recentlyAdded: hydrated.slice(0, 12),
    lovedByBoth: hydrated.filter((track) => track.lovedByBoth),
    playlists,
    myMusic: hydrated.filter((track) => track.savedPersonal),
    partnerMusic: hydrated.filter((track) => track.savedByPartner),
    activity,
  };
}

export async function getTrackDetail(conversationId: string, userId: string, trackId: string) {
  await assertMusicMember(conversationId, userId);
  const track = await requireTrack(conversationId, trackId);
  const [hydrated] = await hydrateTracks(conversationId, userId, [track]);
  const db = getDb();
  const memories = await db
    .select()
    .from(musicTrackMemories)
    .where(eq(musicTrackMemories.trackId, trackId))
    .orderBy(desc(musicTrackMemories.createdAt));
  return { track: hydrated!, memories: memories.map(serializeMemory) };
}

export async function saveResolvedTrack(params: {
  conversationId: string;
  userId: string;
  url?: string;
  trackId?: string;
  youtubeVideoId?: string;
  save?: "personal" | "shared";
  recommend?: { note?: string; clientGeneratedId: string };
  playlistId?: string;
}) {
  await assertMusicMember(params.conversationId, params.userId);
  let trackRow;
  if (params.trackId) {
    trackRow = await requireTrack(params.conversationId, params.trackId);
    if (params.youtubeVideoId) {
      await setPlaybackSource({
        conversationId: params.conversationId,
        userId: params.userId,
        trackId: params.trackId,
        youtubeVideoId: params.youtubeVideoId,
      });
      trackRow = await requireTrack(params.conversationId, params.trackId);
    }
  } else if (params.url) {
    const resolved = await resolveMusicUrl({
      conversationId: params.conversationId,
      url: params.url,
      userId: params.userId,
    });
    trackRow = await upsertCanonicalTrack({
      conversationId: params.conversationId,
      userId: params.userId,
      metadata: resolved.metadata,
      existingTrackId: resolved.existingTrackId,
      youtubeVideoId: params.youtubeVideoId ?? resolved.match.selectedVideoId,
    });
  } else {
    throw new MusicError("VALIDATION_ERROR", "Try another link.", 400);
  }

  if (params.save) {
    await setLibraryEntry({
      conversationId: params.conversationId,
      userId: params.userId,
      trackId: trackRow.id,
      scope: params.save,
      saved: true,
    });
  }
  if (params.recommend) {
    await createRecommendation({
      conversationId: params.conversationId,
      userId: params.userId,
      trackId: trackRow.id,
      note: params.recommend.note,
      clientGeneratedId: params.recommend.clientGeneratedId,
    });
  }
  if (params.playlistId) {
    await addPlaylistTrack({
      conversationId: params.conversationId,
      userId: params.userId,
      playlistId: params.playlistId,
      trackId: trackRow.id,
    });
  }
  const [hydrated] = await hydrateTracks(params.conversationId, params.userId, [
    await requireTrack(params.conversationId, trackRow.id),
  ]);
  notifyMusicChanged(params.conversationId, { trackId: trackRow.id, action: "saved" });
  return hydrated!;
}

export async function searchMusicLibrary(params: {
  conversationId: string;
  userId: string;
  q: string;
  discover: boolean;
}) {
  await assertMusicMember(params.conversationId, params.userId);
  const query = params.q.trim();
  const db = getDb();
  const localRows = query
    ? await db
        .select()
        .from(musicTracks)
        .where(
          and(
            eq(musicTracks.conversationId, params.conversationId),
            or(
              ilike(musicTracks.title, `%${query}%`),
              ilike(musicTracks.artistName, `%${query}%`),
              ilike(musicTracks.albumTitle, `%${query}%`),
            ),
          ),
        )
        .limit(30)
    : [];
  const local = await hydrateTracks(params.conversationId, params.userId, localRows);
  const youtube =
    params.discover && query && hasYouTubeSearch() ? await searchYouTubeVideos(query, 6) : [];
  return { local, youtube, youtubeSearchConfigured: hasYouTubeSearch() };
}

export async function setPlaybackSource(params: {
  conversationId: string;
  userId: string;
  trackId: string;
  youtubeVideoId: string;
}) {
  await assertMusicMember(params.conversationId, params.userId);
  if (!isYouTubeVideoId(params.youtubeVideoId)) {
    throw new MusicError("VALIDATION_ERROR", "This version can’t play here.", 400);
  }
  const track = await requireTrack(params.conversationId, params.trackId);
  const db = getDb();
  await db
    .update(musicTracks)
    .set({
      youtubeVideoId: params.youtubeVideoId,
      youtubePlayable: true,
      updatedAt: new Date(),
    })
    .where(eq(musicTracks.id, track.id));
  await db
    .insert(musicTrackSources)
    .values({
      trackId: track.id,
      provider: "youtube",
      externalId: params.youtubeVideoId,
      url: `https://www.youtube.com/watch?v=${params.youtubeVideoId}`,
      canonicalUrl: `https://www.youtube.com/watch?v=${params.youtubeVideoId}`,
      metadataJson: {},
      addedBy: params.userId,
    })
    .onConflictDoNothing();
  notifyMusicChanged(params.conversationId, { trackId: track.id, action: "source" });
}

export async function createRecommendation(params: {
  conversationId: string;
  userId: string;
  trackId: string;
  note?: string;
  clientGeneratedId: string;
}): Promise<MusicRecommendationDto> {
  await assertMusicMember(params.conversationId, params.userId);
  const partnerId = await getConversationPartnerId(params.conversationId, params.userId);
  if (!partnerId) {
    throw new MusicError("VALIDATION_ERROR", "There’s no one to send this to yet.", 400);
  }
  if (partnerId === params.userId) {
    throw new MusicError("VALIDATION_ERROR", "You can’t recommend a song to yourself.", 400);
  }
  await requireTrack(params.conversationId, params.trackId);
  const db = getDb();
  const existing = (
    await db
      .select()
      .from(musicRecommendations)
      .where(
        and(
          eq(musicRecommendations.senderId, params.userId),
          eq(musicRecommendations.clientGeneratedId, params.clientGeneratedId),
        ),
      )
      .limit(1)
  )[0];
  const row =
    existing ??
    (
      await db
        .insert(musicRecommendations)
        .values({
          conversationId: params.conversationId,
          trackId: params.trackId,
          senderId: params.userId,
          recipientId: partnerId,
          note: params.note ?? null,
          clientGeneratedId: params.clientGeneratedId,
        })
        .returning()
    )[0];
  if (!row) {
    throw new MusicError("UNAVAILABLE", "Couldn’t send that.", 500);
  }
  await writeActivity({
    conversationId: params.conversationId,
    kind: "recommended",
    actorId: params.userId,
    trackId: params.trackId,
    recommendationId: row.id,
    dedupeKey: `recommended:${row.id}`,
  });
  notifyMusicChanged(params.conversationId, { recommendationId: row.id, action: "recommend" });
  const [track] = await hydrateTracks(params.conversationId, params.userId, [
    await requireTrack(params.conversationId, params.trackId),
  ]);
  return serializeRecommendation(row, track!);
}

export async function markRecommendationOpened(params: {
  conversationId: string;
  userId: string;
  recommendationId: string;
}) {
  const db = getDb();
  const row = (
    await db
      .select()
      .from(musicRecommendations)
      .where(
        and(
          eq(musicRecommendations.id, params.recommendationId),
          eq(musicRecommendations.conversationId, params.conversationId),
        ),
      )
      .limit(1)
  )[0];
  if (!row || row.recipientId !== params.userId) {
    throw new MusicError("NOT_FOUND", "That recommendation isn’t here.", 404);
  }
  if (row.status === "pending") {
    await db
      .update(musicRecommendations)
      .set({ status: "opened", openedAt: new Date() })
      .where(eq(musicRecommendations.id, row.id));
    notifyMusicChanged(params.conversationId, { recommendationId: row.id, action: "opened" });
  }
}

export async function markRecommendationListened(params: {
  conversationId: string;
  userId: string;
  recommendationId: string;
}) {
  const db = getDb();
  const row = (
    await db
      .select()
      .from(musicRecommendations)
      .where(
        and(
          eq(musicRecommendations.id, params.recommendationId),
          eq(musicRecommendations.conversationId, params.conversationId),
        ),
      )
      .limit(1)
  )[0];
  if (!row || row.recipientId !== params.userId) {
    throw new MusicError("NOT_FOUND", "That recommendation isn’t here.", 404);
  }
  if (row.status === "pending" || row.status === "opened") {
    await db
      .update(musicRecommendations)
      .set({ status: "listened", listenedAt: new Date(), openedAt: row.openedAt ?? new Date() })
      .where(eq(musicRecommendations.id, row.id));
    notifyMusicChanged(params.conversationId, { recommendationId: row.id, action: "listened" });
  }
}

export async function reactToRecommendation(params: {
  conversationId: string;
  userId: string;
  recommendationId: string;
  reaction: "loved" | "liked" | "not_for_me";
}) {
  const db = getDb();
  const row = (
    await db
      .select()
      .from(musicRecommendations)
      .where(
        and(
          eq(musicRecommendations.id, params.recommendationId),
          eq(musicRecommendations.conversationId, params.conversationId),
        ),
      )
      .limit(1)
  )[0];
  if (!row || row.recipientId !== params.userId) {
    throw new MusicError("NOT_FOUND", "That recommendation isn’t here.", 404);
  }
  await db
    .update(musicRecommendations)
    .set({
      status: params.reaction,
      reactedAt: new Date(),
      listenedAt: row.listenedAt ?? new Date(),
    })
    .where(eq(musicRecommendations.id, row.id));
  if (params.reaction === "loved") {
    await setFavorite({
      conversationId: params.conversationId,
      userId: params.userId,
      trackId: row.trackId,
      favorited: true,
    });
  }
  notifyMusicChanged(params.conversationId, { recommendationId: row.id, action: "react" });
}

export async function listPlaylists(conversationId: string, userId: string): Promise<MusicPlaylistDto[]> {
  await assertMusicMember(conversationId, userId);
  const db = getDb();
  const rows = await db
    .select()
    .from(musicPlaylists)
    .where(eq(musicPlaylists.conversationId, conversationId))
    .orderBy(desc(musicPlaylists.updatedAt));
  const counts = await db
    .select({
      playlistId: musicPlaylistTracks.playlistId,
      count: sql<number>`count(*)::int`,
    })
    .from(musicPlaylistTracks)
    .groupBy(musicPlaylistTracks.playlistId);
  const countBy = new Map(counts.map((row) => [row.playlistId, Number(row.count)]));
  const coverIds = rows.map((row) => row.coverTrackId).filter((id): id is string => Boolean(id));
  const covers =
    coverIds.length > 0
      ? await db
          .select({ id: musicTracks.id, artworkUrl: musicTracks.artworkUrl })
          .from(musicTracks)
          .where(inArray(musicTracks.id, coverIds))
      : [];
  const coverBy = new Map(covers.map((row) => [row.id, row.artworkUrl]));
  return rows.map((row) => serializePlaylist(row, countBy.get(row.id) ?? 0, coverBy.get(row.coverTrackId ?? "") ?? null));
}

export async function createPlaylist(params: {
  conversationId: string;
  userId: string;
  title: string;
  note?: string;
  collaborative?: boolean;
}) {
  await assertMusicMember(params.conversationId, params.userId);
  const db = getDb();
  const [row] = await db
    .insert(musicPlaylists)
    .values({
      conversationId: params.conversationId,
      title: params.title,
      note: params.note ?? null,
      ownerId: params.userId,
      collaborative: params.collaborative ?? false,
    })
    .returning();
  notifyMusicChanged(params.conversationId, { playlistId: row!.id, action: "playlist" });
  return serializePlaylist(row!, 0, null);
}

async function requirePlaylist(conversationId: string, playlistId: string) {
  const db = getDb();
  const row = (
    await db
      .select()
      .from(musicPlaylists)
      .where(and(eq(musicPlaylists.id, playlistId), eq(musicPlaylists.conversationId, conversationId)))
      .limit(1)
  )[0];
  if (!row) {
    throw new MusicError("NOT_FOUND", "That playlist isn’t here.", 404);
  }
  return row;
}

function canEditPlaylist(playlist: { ownerId: string; collaborative: boolean }, userId: string) {
  return playlist.collaborative || playlist.ownerId === userId;
}

export async function getPlaylistDetail(conversationId: string, userId: string, playlistId: string): Promise<MusicPlaylistDetailDto> {
  await assertMusicMember(conversationId, userId);
  const playlist = await requirePlaylist(conversationId, playlistId);
  const db = getDb();
  const items = await db
    .select()
    .from(musicPlaylistTracks)
    .where(eq(musicPlaylistTracks.playlistId, playlistId))
    .orderBy(asc(musicPlaylistTracks.position), asc(musicPlaylistTracks.addedAt));
  const trackRows =
    items.length > 0
      ? await db.select().from(musicTracks).where(inArray(musicTracks.id, items.map((item) => item.trackId)))
      : [];
  const hydrated = await hydrateTracks(conversationId, userId, trackRows);
  const byId = new Map(hydrated.map((track) => [track.id, track]));
  const tracks = items.flatMap((item) => {
    const track = byId.get(item.trackId);
    return track ? [track] : [];
  });
  const cover = tracks[0]?.artworkUrl ?? null;
  return {
    ...serializePlaylist(playlist, tracks.length, cover),
    tracks,
  };
}

export async function patchPlaylist(params: {
  conversationId: string;
  userId: string;
  playlistId: string;
  title?: string;
  note?: string | null;
  collaborative?: boolean;
  coverTrackId?: string | null;
}) {
  const playlist = await requirePlaylist(params.conversationId, params.playlistId);
  if (!canEditPlaylist(playlist, params.userId)) {
    throw new MusicError("FORBIDDEN", "You can’t edit this playlist.", 403);
  }
  const db = getDb();
  await db
    .update(musicPlaylists)
    .set({
      title: params.title ?? playlist.title,
      note: params.note === undefined ? playlist.note : params.note,
      collaborative: params.collaborative ?? playlist.collaborative,
      coverTrackId: params.coverTrackId === undefined ? playlist.coverTrackId : params.coverTrackId,
      updatedAt: new Date(),
    })
    .where(eq(musicPlaylists.id, playlist.id));
  notifyMusicChanged(params.conversationId, { playlistId: playlist.id, action: "playlist" });
  return getPlaylistDetail(params.conversationId, params.userId, playlist.id);
}

export async function deletePlaylist(params: { conversationId: string; userId: string; playlistId: string }) {
  const playlist = await requirePlaylist(params.conversationId, params.playlistId);
  if (playlist.ownerId !== params.userId && !playlist.collaborative) {
    throw new MusicError("FORBIDDEN", "You can’t delete this playlist.", 403);
  }
  if (playlist.ownerId !== params.userId && playlist.collaborative) {
    // Shared playlists: either person may delete after confirmation.
  }
  const db = getDb();
  await db.delete(musicPlaylists).where(eq(musicPlaylists.id, playlist.id));
  notifyMusicChanged(params.conversationId, { playlistId: playlist.id, action: "playlist_deleted" });
}

export async function addPlaylistTrack(params: {
  conversationId: string;
  userId: string;
  playlistId: string;
  trackId: string;
}) {
  const playlist = await requirePlaylist(params.conversationId, params.playlistId);
  if (!canEditPlaylist(playlist, params.userId)) {
    throw new MusicError("FORBIDDEN", "You can’t edit this playlist.", 403);
  }
  await requireTrack(params.conversationId, params.trackId);
  const db = getDb();
  const existing = await db
    .select()
    .from(musicPlaylistTracks)
    .where(eq(musicPlaylistTracks.playlistId, playlist.id));
  if (existing.some((row) => row.trackId === params.trackId)) {
    return getPlaylistDetail(params.conversationId, params.userId, playlist.id);
  }
  const next = existing.reduce((max, row) => Math.max(max, row.position), -1) + 1;
  await db.insert(musicPlaylistTracks).values({
    playlistId: playlist.id,
    trackId: params.trackId,
    position: next,
    addedBy: params.userId,
  });
  if (!playlist.coverTrackId) {
    await db.update(musicPlaylists).set({ coverTrackId: params.trackId, updatedAt: new Date() }).where(eq(musicPlaylists.id, playlist.id));
  } else {
    await db.update(musicPlaylists).set({ updatedAt: new Date() }).where(eq(musicPlaylists.id, playlist.id));
  }
  await writeActivity({
    conversationId: params.conversationId,
    kind: "added_playlist",
    actorId: params.userId,
    trackId: params.trackId,
    playlistId: playlist.id,
    dedupeKey: `playlist-add:${playlist.id}:${params.trackId}`,
  });
  notifyMusicChanged(params.conversationId, { playlistId: playlist.id, action: "items_changed" });
  return getPlaylistDetail(params.conversationId, params.userId, playlist.id);
}

export async function removePlaylistTrack(params: {
  conversationId: string;
  userId: string;
  playlistId: string;
  trackId: string;
}) {
  const playlist = await requirePlaylist(params.conversationId, params.playlistId);
  if (!canEditPlaylist(playlist, params.userId)) {
    throw new MusicError("FORBIDDEN", "You can’t edit this playlist.", 403);
  }
  const db = getDb();
  await db
    .delete(musicPlaylistTracks)
    .where(and(eq(musicPlaylistTracks.playlistId, playlist.id), eq(musicPlaylistTracks.trackId, params.trackId)));
  await db.update(musicPlaylists).set({ updatedAt: new Date() }).where(eq(musicPlaylists.id, playlist.id));
  notifyMusicChanged(params.conversationId, { playlistId: playlist.id, action: "items_changed" });
}

export async function reorderPlaylist(params: {
  conversationId: string;
  userId: string;
  playlistId: string;
  trackIds: string[];
}) {
  const playlist = await requirePlaylist(params.conversationId, params.playlistId);
  if (!canEditPlaylist(playlist, params.userId)) {
    throw new MusicError("FORBIDDEN", "You can’t edit this playlist.", 403);
  }
  const db = getDb();
  await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(musicPlaylistTracks)
      .where(eq(musicPlaylistTracks.playlistId, playlist.id));
    const existingIds = new Set(existing.map((row) => row.trackId));
    const nextIds = new Set(params.trackIds);
    if (existingIds.size !== nextIds.size || [...existingIds].some((id) => !nextIds.has(id))) {
      throw new MusicError("VALIDATION_ERROR", "That order is out of date. Try again.", 400);
    }
    for (const [index, trackId] of params.trackIds.entries()) {
      await tx
        .update(musicPlaylistTracks)
        .set({ position: index })
        .where(and(eq(musicPlaylistTracks.playlistId, playlist.id), eq(musicPlaylistTracks.trackId, trackId)));
    }
    await tx.update(musicPlaylists).set({ updatedAt: new Date() }).where(eq(musicPlaylists.id, playlist.id));
  });
  notifyMusicChanged(params.conversationId, { playlistId: playlist.id, action: "items_changed" });
  return getPlaylistDetail(params.conversationId, params.userId, playlist.id);
}

export async function addMemory(params: {
  conversationId: string;
  userId: string;
  trackId: string;
  text: string;
  clientGeneratedId: string;
}): Promise<MusicMemoryDto> {
  await assertMusicMember(params.conversationId, params.userId);
  await requireTrack(params.conversationId, params.trackId);
  const db = getDb();
  const existing = (
    await db
      .select()
      .from(musicTrackMemories)
      .where(
        and(
          eq(musicTrackMemories.authorId, params.userId),
          eq(musicTrackMemories.clientGeneratedId, params.clientGeneratedId),
        ),
      )
      .limit(1)
  )[0];
  const row =
    existing ??
    (
      await db
        .insert(musicTrackMemories)
        .values({
          trackId: params.trackId,
          authorId: params.userId,
          text: params.text,
          clientGeneratedId: params.clientGeneratedId,
        })
        .returning()
    )[0];
  await writeActivity({
    conversationId: params.conversationId,
    kind: "memory",
    actorId: params.userId,
    trackId: params.trackId,
    dedupeKey: `memory:${row!.id}`,
  });
  notifyMusicChanged(params.conversationId, { trackId: params.trackId, action: "memory" });
  return serializeMemory(row!);
}

export async function deleteMemory(params: {
  conversationId: string;
  userId: string;
  memoryId: string;
}) {
  const db = getDb();
  const row = (await db.select().from(musicTrackMemories).where(eq(musicTrackMemories.id, params.memoryId)).limit(1))[0];
  if (!row) throw new MusicError("NOT_FOUND", "That memory isn’t here.", 404);
  await requireTrack(params.conversationId, row.trackId);
  if (row.authorId !== params.userId) {
    throw new MusicError("FORBIDDEN", "You can only remove your own memory.", 403);
  }
  await db.delete(musicTrackMemories).where(eq(musicTrackMemories.id, row.id));
  notifyMusicChanged(params.conversationId, { trackId: row.trackId, action: "memory" });
}

export async function setSongOfMoment(params: {
  conversationId: string;
  userId: string;
  trackId: string;
}): Promise<MusicSongOfMomentDto> {
  await assertMusicMember(params.conversationId, params.userId);
  const track = await requireTrack(params.conversationId, params.trackId);
  const db = getDb();
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(musicSongOfMoment)
      .set({ endedAt: now })
      .where(and(eq(musicSongOfMoment.conversationId, params.conversationId), sql`${musicSongOfMoment.endedAt} is null`));
    await tx.insert(musicSongOfMoment).values({
      conversationId: params.conversationId,
      trackId: track.id,
      setBy: params.userId,
      startedAt: now,
    });
  });
  await writeActivity({
    conversationId: params.conversationId,
    kind: "song_of_moment",
    actorId: params.userId,
    trackId: track.id,
    dedupeKey: `som:${params.conversationId}:${now.toISOString()}`,
  });
  notifyMusicChanged(params.conversationId, { trackId: track.id, action: "song_of_moment" });
  const [hydrated] = await hydrateTracks(params.conversationId, params.userId, [track]);
  return {
    id: "active",
    track: hydrated!,
    setBy: params.userId,
    startedAt: now.toISOString(),
    endedAt: null,
  };
}

export async function listSongOfMomentHistory(conversationId: string, userId: string) {
  await assertMusicMember(conversationId, userId);
  const db = getDb();
  const rows = await db
    .select()
    .from(musicSongOfMoment)
    .where(eq(musicSongOfMoment.conversationId, conversationId))
    .orderBy(desc(musicSongOfMoment.startedAt))
    .limit(40);
  const tracks = rows.length
    ? await db.select().from(musicTracks).where(inArray(musicTracks.id, rows.map((row) => row.trackId)))
    : [];
  const hydrated = await hydrateTracks(conversationId, userId, tracks);
  const byId = new Map(hydrated.map((track) => [track.id, track]));
  return rows.flatMap((row) => {
    const track = byId.get(row.trackId);
    if (!track) return [];
    return [
      {
        id: row.id,
        track,
        setBy: row.setBy,
        startedAt: row.startedAt.toISOString(),
        endedAt: row.endedAt?.toISOString() ?? null,
      } satisfies MusicSongOfMomentDto,
    ];
  });
}

export async function groupAlbums(conversationId: string, userId: string): Promise<MusicAlbumGroupDto[]> {
  const home = await getMusicHome(conversationId, userId);
  const all = [...home.ourSongs, ...home.myMusic, ...home.partnerMusic];
  const seen = new Set<string>();
  const unique = all.filter((track) => {
    if (seen.has(track.id)) return false;
    seen.add(track.id);
    return Boolean(track.albumTitle);
  });
  const groups = new Map<string, MusicAlbumGroupDto>();
  for (const track of unique) {
    const key = `${track.albumTitle ?? ""}::${track.albumArtist ?? track.artistName}`;
    const group = groups.get(key) ?? {
      albumTitle: track.albumTitle!,
      albumArtist: track.albumArtist ?? track.artistName,
      artworkUrl: track.artworkUrl,
      tracks: [],
    };
    group.tracks.push(track);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export async function groupArtists(conversationId: string, userId: string): Promise<MusicArtistGroupDto[]> {
  const home = await getMusicHome(conversationId, userId);
  const all = [...home.ourSongs, ...home.myMusic, ...home.partnerMusic];
  const seen = new Set<string>();
  const groups = new Map<string, MusicArtistGroupDto>();
  for (const track of all) {
    if (seen.has(track.id)) continue;
    seen.add(track.id);
    const group = groups.get(track.artistName) ?? { artistName: track.artistName, tracks: [] };
    group.tracks.push(track);
    groups.set(track.artistName, group);
  }
  return [...groups.values()];
}

export async function recordRecentlyPlayed(params: { userId: string; conversationId: string; trackId: string }) {
  await assertMusicMember(params.conversationId, params.userId);
  await requireTrack(params.conversationId, params.trackId);
  const db = getDb();
  await db
    .insert(musicRecentlyPlayed)
    .values({ userId: params.userId, trackId: params.trackId, playedAt: new Date(), playCount: 1 })
    .onConflictDoUpdate({
      target: [musicRecentlyPlayed.userId, musicRecentlyPlayed.trackId],
      set: {
        playedAt: new Date(),
        playCount: sql`${musicRecentlyPlayed.playCount} + 1`,
      },
    });
}

export async function getOfflineSnapshot(conversationId: string, userId: string) {
  const home = await getMusicHome(conversationId, userId);
  return {
    tracks: [...home.ourSongs, ...home.myMusic, ...home.partnerMusic, ...home.lovedByBoth, ...home.recentlyAdded],
    playlists: home.playlists,
    recommendations: [...home.forYou, ...home.sentByMe],
  };
}
