import { inArray } from "drizzle-orm";

import type { MusicShareRef } from "@/lib/chat/types";
import { getDb } from "@/lib/db";
import { musicLibraryEntries, musicMessageShares, musicTracks } from "@/lib/db/schema";

export async function loadMusicForMessages(
  messageIds: string[],
  viewerId: string,
): Promise<Map<string, MusicShareRef>> {
  const map = new Map<string, MusicShareRef>();
  if (messageIds.length === 0) return map;
  const db = getDb();
  const shareRows = await db
    .select()
    .from(musicMessageShares)
    .where(inArray(musicMessageShares.messageId, messageIds));
  if (shareRows.length === 0) return map;
  const trackIds = [...new Set(shareRows.map((row) => row.trackId))];
  const [tracks, library] = await Promise.all([
    db.select().from(musicTracks).where(inArray(musicTracks.id, trackIds)),
    db.select().from(musicLibraryEntries).where(inArray(musicLibraryEntries.trackId, trackIds)),
  ]);
  const byTrack = new Map(tracks.map((track) => [track.id, track]));
  for (const share of shareRows) {
    const track = byTrack.get(share.trackId);
    if (!track) continue;
    map.set(share.messageId, {
      trackId: track.id,
      title: track.title,
      artistName: track.artistName,
      artworkUrl: track.artworkUrl,
      durationMs: track.durationMs,
      youtubeVideoId: share.youtubeVideoId ?? track.youtubeVideoId,
      youtubePlayable: track.youtubePlayable,
      clipStartMs: share.clipStartMs,
      clipEndMs: share.clipEndMs,
      savedPersonal: library.some(
        (row) => row.trackId === track.id && row.scope === "personal" && row.userId === viewerId,
      ),
      savedShared: library.some((row) => row.trackId === track.id && row.scope === "shared"),
    });
  }
  return map;
}
