"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { ShhhButton, ShhhInput, ShhhSheet } from "@/components/shhh";
import { MusicArtwork } from "@/features/music/music-artwork";
import { useMusicPlayer } from "@/features/music/music-player-provider";
import { musicKeys } from "@/features/music/query-keys";
import {
  apiCreatePlaylist,
  apiMusicHome,
  apiRecommendTrack,
  apiResolveMusic,
  apiSaveTrack,
  apiSearchMusic,
  apiSendMusicMessage,
} from "@/lib/music/client-api";
import { displayArtistName } from "@/lib/music/copy";
import { useConnectionState } from "@/lib/connection/use-connection-state";
type ResolvePreview = import("@/lib/music/providers/types").ResolvePreview;
import type { MusicTrackDto } from "@/lib/music/types";

export function AddMusicSheet({
  onSaved,
}: {
  onSaved?: (track: MusicTrackDto) => void;
}) {
  const player = useMusicPlayer();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"search" | "link">("link");
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState(player.addUrl);
  const [preview, setPreview] = useState<ResolvePreview | null>(null);
  const [chosenVideo, setChosenVideo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const offline = useConnectionState() === "offline";

  /* eslint-disable react-hooks/set-state-in-effect -- prefills paste-link from share target / chat */
  useEffect(() => {
    if (player.addOpen) setUrl(player.addUrl);
  }, [player.addOpen, player.addUrl]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const home = useQuery({
    queryKey: musicKeys.home(),
    queryFn: apiMusicHome,
    enabled: player.addOpen,
  });

  const search = useQuery({
    queryKey: musicKeys.search(query),
    queryFn: () => apiSearchMusic(query, true),
    enabled: player.addOpen && tab === "search" && query.trim().length > 1,
  });

  const resolve = useMutation({
    mutationFn: () => apiResolveMusic(url),
    onSuccess: (data) => {
      setPreview(data.preview);
      setChosenVideo(data.preview.match.selectedVideoId);
      setError(null);
    },
    onError: (error) =>
      setError(error instanceof Error ? error.message : "Couldn’t find that song."),
  });

  async function save(opts: { save?: "personal" | "shared"; recommend?: boolean; playlistId?: string; send?: boolean }) {
    if (offline) {
      setError("You’re offline — add songs when you’re back.");
      return;
    }
    try {
      const track = (
        await apiSaveTrack({
          url: preview ? url : undefined,
          youtubeVideoId: chosenVideo ?? undefined,
          save: opts.save,
          playlistId: opts.playlistId,
        })
      ).track;
      if (opts.recommend) {
        await apiRecommendTrack(track.id, undefined, crypto.randomUUID());
      }
      if (opts.send) {
        await apiSendMusicMessage({ trackId: track.id, clientGeneratedId: crypto.randomUUID() });
      }
      await queryClient.invalidateQueries({ queryKey: musicKeys.all });
      onSaved?.(track);
      player.closeAdd();
      setPreview(null);
    } catch {
      setError("Couldn’t save that song.");
    }
  }

  return (
    <ShhhSheet
      open={player.addOpen}
      onClose={player.closeAdd}
      title="Add Music"
      data-testid="add-music-sheet"
    >
      {offline ? (
        <p className="text-secondary-text mb-3 text-sm">You’re offline — paste a link again when you’re back.</p>
      ) : null}
      <div className="mb-4 flex gap-2">
        {(["link", "search"] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`min-h-11 rounded-full px-4 text-sm font-semibold ${
              tab === value ? "bg-accent-soft text-accent" : "bg-bg-soft text-secondary-text"
            }`}
            onClick={() => setTab(value)}
          >
            {value === "link" ? "Paste link" : "Search Music"}
          </button>
        ))}
      </div>

      {tab === "link" ? (
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setUrl(url);
            resolve.mutate();
          }}
        >
          <ShhhInput
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="Spotify, Apple Music, or YouTube link"
            aria-label="Music link"
            data-testid="add-music-url"
          />
          <ShhhButton type="submit" disabled={!url.trim() || offline} data-testid="add-music-resolve">
            Look up
          </ShhhButton>
        </form>
      ) : (
        <div className="grid gap-3">
          <ShhhInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search our songs, or YouTube"
            aria-label="Search music"
            data-testid="add-music-search"
          />
          {search.data?.local?.map((track) => (
                <button
                  key={track.id}
                  type="button"
                  className="flex items-center gap-3 rounded-[1.2rem] p-2 text-start hover:bg-accent-soft/40"
                  onClick={() =>
                    setPreview({
                      metadata: {
                        provider: "youtube",
                        externalId: track.youtubeVideoId,
                        url: "",
                        canonicalUrl: "",
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
                        confidence: "confident",
                        candidates: [],
                        selectedVideoId: track.youtubeVideoId,
                      },
                    })
                  }
                >
                  <MusicArtwork src={track.artworkUrl} alt="" size="sm" />
                  <span>
                    <span className="block text-sm font-semibold">{track.title}</span>
                    <span className="text-secondary-text text-xs">{displayArtistName(track.artistName)}</span>
                  </span>
                </button>
              ))}
          {search.data?.youtube?.length ? (
            <div className="mt-2" data-testid="music-youtube-results">
              <p className="text-secondary-text mb-2 text-xs font-semibold">From YouTube</p>
              {search.data.youtube.map((hit) => (
                <button
                  key={hit.videoId}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-[1.2rem] p-2 text-start hover:bg-accent-soft/40"
                  onClick={() => {
                    setTab("link");
                    setUrl(`https://www.youtube.com/watch?v=${hit.videoId}`);
                    setPreview({
                      metadata: {
                        provider: "youtube",
                        externalId: hit.videoId,
                        url: `https://www.youtube.com/watch?v=${hit.videoId}`,
                        canonicalUrl: `https://www.youtube.com/watch?v=${hit.videoId}`,
                        title: hit.title,
                        artistName: hit.channelTitle,
                        albumTitle: null,
                        albumArtist: null,
                        artworkUrl: hit.artworkUrl,
                        durationMs: hit.durationMs,
                        releaseYear: null,
                        isrc: null,
                        youtubeVideoId: hit.videoId,
                      },
                      existingTrackId: null,
                      match: {
                        confidence: "confident",
                        candidates: [],
                        selectedVideoId: hit.videoId,
                      },
                    });
                    setChosenVideo(hit.videoId);
                  }}
                >
                  <MusicArtwork src={hit.artworkUrl} alt="" size="sm" />
                  <span>
                    <span className="block text-sm font-semibold">{hit.title}</span>
                    <span className="text-secondary-text text-xs">{hit.channelTitle}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          {search.data && !search.data.youtubeSearchConfigured && query.trim().length > 1 && !search.data.local?.length ? (
            <p className="text-secondary-text text-sm">YouTube search isn’t configured. Paste a link instead.</p>
          ) : null}
        </div>
      )}

      {error ? <p className="text-danger mt-3 text-sm">{error}</p> : null}

      {preview ? (
        <div className="bg-bg-soft mt-5 rounded-[1.5rem] p-4" data-testid="add-music-preview">
          <div className="flex gap-3">
            <MusicArtwork src={preview.metadata.artworkUrl} alt="" size="lg" />
            <div className="min-w-0">
              <p className="font-semibold text-primary-text">{preview.metadata.title}</p>
              <p className="text-secondary-text text-sm">{displayArtistName(preview.metadata.artistName)}</p>
            </div>
          </div>
          {preview.match.confidence === "ambiguous" && preview.match.candidates.length > 0 ? (
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold">Choose playback version</p>
              <div className="grid gap-2">
                {preview.match.candidates.slice(0, 5).map((hit) => (
                  <button
                    key={hit.videoId}
                    type="button"
                    className={`rounded-[1.1rem] px-3 py-2 text-start text-sm ${
                      chosenVideo === hit.videoId ? "bg-accent-soft text-accent" : "bg-surface-elevated"
                    }`}
                    onClick={() => setChosenVideo(hit.videoId)}
                  >
                    {hit.title}
                    <span className="text-secondary-text block text-xs">{hit.channelTitle}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-4 grid gap-2">
            <ShhhButton onClick={() => void save({ save: "personal" })}>Save to My Music</ShhhButton>
            <ShhhButton variant="secondary" onClick={() => void save({ save: "shared" })}>
              Save to Our Music
            </ShhhButton>
            <ShhhButton variant="secondary" onClick={() => void save({ recommend: true })}>
              Recommend
            </ShhhButton>
            <ShhhButton variant="ghost" onClick={() => void save({ send: true })}>
              Send to Chat
            </ShhhButton>
            {home.data?.home.playlists[0] ? (
              <ShhhButton
                variant="ghost"
                onClick={() => void save({ playlistId: home.data!.home.playlists[0]!.id })}
              >
                Add to {home.data.home.playlists[0].title}
              </ShhhButton>
            ) : (
              <ShhhButton
                variant="ghost"
                onClick={async () => {
                  const created = await apiCreatePlaylist("Ours", true);
                  if (created.playlist?.id) await save({ playlistId: created.playlist.id });
                }}
              >
                Make a playlist
              </ShhhButton>
            )}
          </div>
        </div>
      ) : null}
    </ShhhSheet>
  );
}
