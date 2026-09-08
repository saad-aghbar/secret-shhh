"use client";

import { isClientHttpError, toApiClientError } from "@/lib/http/client-error";
import { connectionManager } from "@/lib/connection/manager";
import type { MusicAlbumGroupDto, MusicArtistGroupDto, MusicHomeDto, MusicPlaylistDetailDto, MusicPlaylistDto, MusicTrackDto } from "@/lib/music/types";
import type { ApiErrorBody } from "@/types/api";

async function parse<T>(input: Response | Promise<Response>): Promise<T> {
  const response = await input;
  const body = (await response.json()) as T | ApiErrorBody;
  if (!response.ok) {
    throw toApiClientError(body as ApiErrorBody, response.status);
  }
  return body as T;
}

async function timed<T>(fn: () => Promise<T>): Promise<T> {
  const started = Date.now();
  try {
    const result = await fn();
    connectionManager.reportSuccess(Date.now() - started);
    return result;
  } catch (error) {
    if (!isClientHttpError(error)) connectionManager.reportFailure();
    throw error;
  }
}

export async function apiMusicHome() {
  return timed(() => parse<{ home: MusicHomeDto; viewerId: string }>(fetch("/api/music/home")));
}

export async function apiResolveMusic(url: string) {
  return timed(() =>
    parse<{ preview: import("@/lib/music/providers/types").ResolvePreview }>(
      fetch("/api/music/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      }),
    ),
  );
}

export async function apiSaveTrack(body: Record<string, unknown>) {
  return timed(() =>
    parse<{ track: MusicTrackDto }>(
      fetch("/api/music/tracks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    ),
  );
}

export async function apiGetTrack(id: string) {
  return timed(() => parse<{ track: MusicTrackDto; memories: import("@/lib/music/types").MusicMemoryDto[] }>(fetch(`/api/music/tracks/${id}`)));
}

export async function apiPatchLibrary(id: string, scope: "personal" | "shared", saved: boolean) {
  return timed(() =>
    parse<{ ok: boolean }>(
      fetch(`/api/music/tracks/${id}/library`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope, saved }),
      }),
    ),
  );
}

export async function apiPatchFavorite(id: string, favorited: boolean) {
  return timed(() =>
    parse<{ ok: boolean }>(
      fetch(`/api/music/tracks/${id}/favorite`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ favorited }),
      }),
    ),
  );
}

export async function apiSetPlayback(id: string, youtubeVideoId: string) {
  return timed(() =>
    parse<{ ok: boolean }>(
      fetch(`/api/music/tracks/${id}/playback`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ youtubeVideoId }),
      }),
    ),
  );
}

export async function apiRecommendTrack(id: string, note: string | undefined, clientGeneratedId: string) {
  return timed(() =>
    parse(
      fetch(`/api/music/tracks/${id}/recommend`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note, clientGeneratedId }),
      }),
    ),
  );
}

export async function apiAddMemory(id: string, text: string, clientGeneratedId: string) {
  return timed(() =>
    parse(
      fetch(`/api/music/tracks/${id}/memories`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, clientGeneratedId }),
      }),
    ),
  );
}

export async function apiSearchMusic(q: string, discover = false) {
  const params = new URLSearchParams({ q, discover: discover ? "1" : "0" });
  return timed(() =>
    parse<{
      local: MusicTrackDto[];
      youtube: import("@/lib/music/providers/types").YouTubeSearchHit[];
      youtubeSearchConfigured: boolean;
    }>(fetch(`/api/music/search?${params}`)),
  );
}

export async function apiCreatePlaylist(title: string, collaborative: boolean, note?: string) {
  return timed(() =>
    parse<{ playlist: MusicPlaylistDto }>(
      fetch("/api/music/playlists", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, collaborative, note }),
      }),
    ),
  );
}

export async function apiGetPlaylist(id: string) {
  return timed(() => parse<{ playlist: MusicPlaylistDetailDto }>(fetch(`/api/music/playlists/${id}`)));
}

export async function apiAddToPlaylist(playlistId: string, trackId: string) {
  return timed(() =>
    parse(
      fetch(`/api/music/playlists/${playlistId}/tracks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trackId }),
      }),
    ),
  );
}

export async function apiReorderPlaylist(playlistId: string, trackIds: string[]) {
  return timed(() =>
    parse(
      fetch(`/api/music/playlists/${playlistId}/order`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trackIds }),
      }),
    ),
  );
}

export async function apiRemovePlaylistTrack(playlistId: string, trackId: string) {
  return timed(() => parse(fetch(`/api/music/playlists/${playlistId}/tracks/${trackId}`, { method: "DELETE" })));
}

export async function apiDeletePlaylist(playlistId: string) {
  return timed(() => parse(fetch(`/api/music/playlists/${playlistId}`, { method: "DELETE" })));
}

export async function apiSetSongOfMoment(trackId: string) {
  return timed(() =>
    parse(
      fetch("/api/music/song-of-moment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trackId }),
      }),
    ),
  );
}

export async function apiSongHistory() {
  return timed(() => parse<{ history: import("@/lib/music/types").MusicSongOfMomentDto[] }>(fetch("/api/music/song-of-moment")));
}

export async function apiRecommendationOpen(id: string) {
  return timed(() => parse(fetch(`/api/music/recommendations/${id}/open`, { method: "POST" })));
}

export async function apiRecommendationListened(id: string) {
  return timed(() => parse(fetch(`/api/music/recommendations/${id}/listened`, { method: "POST" })));
}

export async function apiRecommendationReact(id: string, reaction: "loved" | "liked" | "not_for_me") {
  return timed(() =>
    parse(
      fetch(`/api/music/recommendations/${id}/react`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reaction }),
      }),
    ),
  );
}

export async function apiRecordPlayed(trackId: string) {
  return timed(() =>
    parse(
      fetch("/api/music/played", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trackId }),
      }),
    ),
  );
}

export async function apiMusicSnapshot() {
  return timed(() => parse(fetch("/api/music/snapshot")));
}

export async function apiAlbums() {
  return timed(() => parse<{ albums: MusicAlbumGroupDto[] }>(fetch("/api/music/albums")));
}

export async function apiArtists() {
  return timed(() => parse<{ artists: MusicArtistGroupDto[] }>(fetch("/api/music/artists")));
}

export async function apiSendMusicMessage(input: {
  trackId: string;
  clientGeneratedId: string;
  text?: string;
  clipStartMs?: number;
  clipEndMs?: number;
  youtubeVideoId?: string;
  replyToMessageId?: string;
}) {
  return timed(() =>
    parse(
      fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          music: {
            trackId: input.trackId,
            clipStartMs: input.clipStartMs,
            clipEndMs: input.clipEndMs,
            youtubeVideoId: input.youtubeVideoId,
          },
          text: input.text,
          clientGeneratedId: input.clientGeneratedId,
          replyToMessageId: input.replyToMessageId,
        }),
      }),
    ),
  );
}
