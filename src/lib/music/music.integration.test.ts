import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { bootstrapUserBySlot } from "@/lib/auth/bootstrap";
import { getDb } from "@/lib/db";
import {
  messageReceipts,
  messages,
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
import { sendMusicMessage } from "@/lib/music/send";
import {
  addPlaylistTrack,
  createPlaylist,
  createRecommendation,
  getMusicHome,
  listSongOfMomentHistory,
  markRecommendationListened,
  reactToRecommendation,
  reorderPlaylist,
  setSongOfMoment,
} from "@/lib/music/service";
import { assertMusicMember, setFavorite, setLibraryEntry, upsertCanonicalTrack } from "@/lib/music/store";

const canRun = Boolean(process.env.DATABASE_URL);

describe.skipIf(!canRun)("phase 15 music integration", () => {
  const trackIds: string[] = [];
  const playlistIds: string[] = [];
  const messageIds: string[] = [];

  afterAll(async () => {
    const db = getDb();
    for (const id of messageIds) {
      await db.delete(messageReceipts).where(eq(messageReceipts.messageId, id));
      await db.delete(messages).where(eq(messages.id, id));
    }
    for (const id of playlistIds) {
      await db.delete(musicPlaylistTracks).where(eq(musicPlaylistTracks.playlistId, id));
      await db.delete(musicPlaylists).where(eq(musicPlaylists.id, id));
    }
    for (const id of trackIds) {
      await db.delete(musicActivity).where(eq(musicActivity.trackId, id));
      await db.delete(musicTrackMemories).where(eq(musicTrackMemories.trackId, id));
      await db.delete(musicFavorites).where(eq(musicFavorites.trackId, id));
      await db.delete(musicLibraryEntries).where(eq(musicLibraryEntries.trackId, id));
      await db.delete(musicRecommendations).where(eq(musicRecommendations.trackId, id));
      await db.delete(musicSongOfMoment).where(eq(musicSongOfMoment.trackId, id));
      await db.delete(musicTrackSources).where(eq(musicTrackSources.trackId, id));
      await db.delete(musicTracks).where(eq(musicTracks.id, id));
    }
  });

  it("saves a canonical track, libraries, Loved by Both, playlist, recommend, and song of the moment", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const tala = await bootstrapUserBySlot({ slot: "user_2", displayName: "Tala" });
    const videoId = `t${randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const track = await upsertCanonicalTrack({
      conversationId: saad.conversationId,
      userId: saad.user.id,
      metadata: {
        provider: "youtube",
        externalId: videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
        title: "Never Gonna Give You Up",
        artistName: "Rick Astley",
        albumTitle: "Whenever You Need Somebody",
        albumArtist: "Rick Astley",
        artworkUrl: null,
        durationMs: 213_000,
        releaseYear: 1987,
        isrc: null,
        youtubeVideoId: videoId,
      },
      existingTrackId: null,
      youtubeVideoId: videoId,
    });
    trackIds.push(track.id);

    await setLibraryEntry({
      conversationId: saad.conversationId,
      userId: saad.user.id,
      trackId: track.id,
      scope: "shared",
      saved: true,
    });
    await setFavorite({
      conversationId: saad.conversationId,
      userId: saad.user.id,
      trackId: track.id,
      favorited: true,
    });
    await setFavorite({
      conversationId: tala.conversationId,
      userId: tala.user.id,
      trackId: track.id,
      favorited: true,
    });

    const home = await getMusicHome(saad.conversationId, saad.user.id);
    expect(home.lovedByBoth.some((item) => item.id === track.id)).toBe(true);
    expect(home.ourSongs.some((item) => item.id === track.id)).toBe(true);

    const playlist = await createPlaylist({
      conversationId: saad.conversationId,
      userId: saad.user.id,
      title: "Ours",
      collaborative: true,
    });
    playlistIds.push(playlist.id);
    await addPlaylistTrack({
      conversationId: saad.conversationId,
      userId: tala.user.id,
      playlistId: playlist.id,
      trackId: track.id,
    });
    await reorderPlaylist({
      conversationId: saad.conversationId,
      userId: saad.user.id,
      playlistId: playlist.id,
      trackIds: [track.id],
    });

    await createRecommendation({
      conversationId: saad.conversationId,
      userId: saad.user.id,
      trackId: track.id,
      clientGeneratedId: randomUUID(),
    });
    await setSongOfMoment({
      conversationId: saad.conversationId,
      userId: tala.user.id,
      trackId: track.id,
    });
    const after = await getMusicHome(tala.conversationId, tala.user.id);
    expect(after.songOfMoment?.track.id).toBe(track.id);
    expect(after.forYou.length + after.sentByMe.length).toBeGreaterThan(0);
  });

  it("rejects a clip longer than 30s and forged conversation access", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const videoId = "clipTest111";
    const track = await upsertCanonicalTrack({
      conversationId: saad.conversationId,
      userId: saad.user.id,
      metadata: {
        provider: "youtube",
        externalId: videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
        title: "Clip test",
        artistName: "Rick Astley",
        albumTitle: null,
        albumArtist: null,
        artworkUrl: null,
        durationMs: 213_000,
        releaseYear: null,
        isrc: null,
        youtubeVideoId: videoId,
      },
      existingTrackId: null,
      youtubeVideoId: videoId,
    });
    trackIds.push(track.id);

    await expect(
      sendMusicMessage({
        requestId: randomUUID(),
        userId: saad.user.id,
        conversationId: saad.conversationId,
        trackId: track.id,
        clientGeneratedId: randomUUID(),
        clipStartMs: 0,
        clipEndMs: 31_000,
      }),
    ).rejects.toThrow();

    await expect(assertMusicMember(randomUUID(), saad.user.id)).rejects.toBeInstanceOf(MusicError);

    const sent = await sendMusicMessage({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      trackId: track.id,
      clientGeneratedId: randomUUID(),
      clipStartMs: 1_000,
      clipEndMs: 12_000,
    });
    messageIds.push(sent.id);
    expect(sent.type).toBe("music");
    expect(sent.music?.clipEndMs).toBe(12_000);
  });

  it("replaces Song of the Moment and keeps history", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    async function makeTrack(id: string, title: string) {
      const track = await upsertCanonicalTrack({
        conversationId: saad.conversationId,
        userId: saad.user.id,
        metadata: {
          provider: "youtube",
          externalId: id,
          url: `https://www.youtube.com/watch?v=${id}`,
          canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
          title,
          artistName: "Test",
          albumTitle: null,
          albumArtist: null,
          artworkUrl: null,
          durationMs: 180_000,
          releaseYear: null,
          isrc: null,
          youtubeVideoId: id,
        },
        existingTrackId: null,
        youtubeVideoId: id,
      });
      trackIds.push(track.id);
      return track;
    }
    const first = await makeTrack("somFirst111", "First moment");
    const second = await makeTrack("somSecond11", "Second moment");
    await setSongOfMoment({
      conversationId: saad.conversationId,
      userId: saad.user.id,
      trackId: first.id,
    });
    await setSongOfMoment({
      conversationId: saad.conversationId,
      userId: saad.user.id,
      trackId: second.id,
    });
    const home = await getMusicHome(saad.conversationId, saad.user.id);
    expect(home.songOfMoment?.track.id).toBe(second.id);
    const history = await listSongOfMomentHistory(saad.conversationId, saad.user.id);
    expect(history.some((row) => row.track.id === first.id && row.endedAt)).toBe(true);
  });

  it("progresses recommendation status and blocks personal playlist edits", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const tala = await bootstrapUserBySlot({ slot: "user_2", displayName: "Tala" });
    const videoId = "recStatus11";
    const track = await upsertCanonicalTrack({
      conversationId: saad.conversationId,
      userId: saad.user.id,
      metadata: {
        provider: "youtube",
        externalId: videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
        title: "Recommend me",
        artistName: "Test",
        albumTitle: null,
        albumArtist: null,
        artworkUrl: null,
        durationMs: 180_000,
        releaseYear: null,
        isrc: null,
        youtubeVideoId: videoId,
      },
      existingTrackId: null,
      youtubeVideoId: videoId,
    });
    trackIds.push(track.id);

    const rec = await createRecommendation({
      conversationId: saad.conversationId,
      userId: saad.user.id,
      trackId: track.id,
      clientGeneratedId: randomUUID(),
    });
    await markRecommendationListened({
      conversationId: tala.conversationId,
      userId: tala.user.id,
      recommendationId: rec.id,
    });
    await reactToRecommendation({
      conversationId: tala.conversationId,
      userId: tala.user.id,
      recommendationId: rec.id,
      reaction: "loved",
    });
    const home = await getMusicHome(tala.conversationId, tala.user.id);
    expect(home.forYou.find((item) => item.id === rec.id)?.status).toBe("loved");

    const personal = await createPlaylist({
      conversationId: saad.conversationId,
      userId: saad.user.id,
      title: "Saad only",
      collaborative: false,
    });
    playlistIds.push(personal.id);
    await expect(
      addPlaylistTrack({
        conversationId: tala.conversationId,
        userId: tala.user.id,
        playlistId: personal.id,
        trackId: track.id,
      }),
    ).rejects.toBeInstanceOf(MusicError);
  });

  it("rejects a playback id that does not belong to the track", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const videoId = "ownedVideo1";
    const track = await upsertCanonicalTrack({
      conversationId: saad.conversationId,
      userId: saad.user.id,
      metadata: {
        provider: "youtube",
        externalId: videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
        title: "Owned",
        artistName: "Test",
        albumTitle: null,
        albumArtist: null,
        artworkUrl: null,
        durationMs: 180_000,
        releaseYear: null,
        isrc: null,
        youtubeVideoId: videoId,
      },
      existingTrackId: null,
      youtubeVideoId: videoId,
    });
    trackIds.push(track.id);
    await expect(
      sendMusicMessage({
        requestId: randomUUID(),
        userId: saad.user.id,
        conversationId: saad.conversationId,
        trackId: track.id,
        clientGeneratedId: randomUUID(),
        youtubeVideoId: "forged11111",
      }),
    ).rejects.toThrow();
  });
});
