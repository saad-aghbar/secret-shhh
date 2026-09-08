import { getChatDb } from "@/lib/sync/db";
import { apiAddMemory, apiPatchFavorite, apiPatchLibrary } from "@/lib/music/client-api";
import type {
  CachedMusicPlaylist,
  CachedMusicRecommendation,
  CachedMusicTrack,
  PendingMusicMutation,
} from "@/lib/music/offline-types";
import type { MusicPlaylistDto, MusicRecommendationDto, MusicTrackDto } from "@/lib/music/types";

export type { PendingMusicKind, PendingMusicMutation } from "@/lib/music/offline-types";

export async function cacheMusicSnapshot(input: {
  tracks: MusicTrackDto[];
  playlists: MusicPlaylistDto[];
  recommendations: MusicRecommendationDto[];
}) {
  try {
    const db = getChatDb();
    const now = new Date().toISOString();
    const uniqueTracks = [...new Map(input.tracks.map((track) => [track.id, track])).values()];
    await db.transaction("rw", [db.cachedMusicTracks, db.cachedMusicPlaylists, db.cachedMusicRecommendations], async () => {
      await db.cachedMusicTracks.bulkPut(uniqueTracks.map((track) => ({ ...track, updatedAt: now })));
      await db.cachedMusicPlaylists.bulkPut(input.playlists.map((playlist) => ({ ...playlist, updatedAt: now })));
      await db.cachedMusicRecommendations.bulkPut(
        input.recommendations.map((item) => ({ ...item, updatedAt: now })),
      );
    });
  } catch {
    /* IndexedDB unavailable */
  }
}

export async function queueMusicMutation(
  input: Omit<PendingMusicMutation, "id" | "status" | "createdAt"> & { id?: string },
) {
  const db = getChatDb();
  const row: PendingMusicMutation = {
    id: input.id ?? `${input.kind}:${input.trackId}:${input.clientGeneratedId ?? "na"}`,
    kind: input.kind,
    trackId: input.trackId,
    favorited: input.favorited,
    scope: input.scope,
    saved: input.saved,
    text: input.text,
    clientGeneratedId: input.clientGeneratedId,
    status: "queued",
    createdAt: new Date().toISOString(),
  };
  await db.pendingMusicMutations.put(row);
}

export async function flushPendingMusicMutations() {
  const db = getChatDb();
  const pending = await db.pendingMusicMutations.toArray();
  for (const item of pending) {
    try {
      await db.pendingMusicMutations.put({ ...item, status: "sending" });
      if (item.kind === "favorite" && typeof item.favorited === "boolean") {
        await apiPatchFavorite(item.trackId, item.favorited);
      } else if (item.kind === "library" && item.scope && typeof item.saved === "boolean") {
        await apiPatchLibrary(item.trackId, item.scope, item.saved);
      } else if (item.kind === "memory" && item.text && item.clientGeneratedId) {
        await apiAddMemory(item.trackId, item.text, item.clientGeneratedId);
      }
      await db.pendingMusicMutations.delete(item.id);
    } catch {
      await db.pendingMusicMutations.put({ ...item, status: "failed" });
    }
  }
}

export type { CachedMusicPlaylist, CachedMusicRecommendation, CachedMusicTrack };
