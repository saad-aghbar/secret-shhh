"use client";

import { Heart, MoreHorizontal, Share2, Sparkles } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ShhhButton, ShhhIconButton, ShhhInput, ShhhSheet } from "@/components/shhh";
import { MusicArtwork } from "@/features/music/music-artwork";
import { useMusicPlayer } from "@/features/music/music-player-provider";
import { musicKeys } from "@/features/music/query-keys";
import {
  apiAddMemory,
  apiAddToPlaylist,
  apiMusicHome,
  apiPatchFavorite,
  apiPatchLibrary,
  apiRecommendTrack,
  apiSendMusicMessage,
  apiSetPlayback,
  apiSetSongOfMoment,
  apiSongHistory,
} from "@/lib/music/client-api";
import { queueMusicMutation } from "@/lib/music/offline";
import { useConnectionState } from "@/lib/connection/use-connection-state";
import { displayArtistName, sourceLabel } from "@/lib/music/copy";
import { toQueueItem } from "@/lib/music/player/queue";
import type { MusicMemoryDto, MusicTrackDto } from "@/lib/music/types";

export function MusicTrackDetail({
  track,
  memories,
  userId,
  userName,
  partnerName,
  onBack,
  onClip,
}: {
  track: MusicTrackDto;
  memories: MusicMemoryDto[];
  userId: string;
  userName: string;
  partnerName: string;
  onBack: () => void;
  onClip: () => void;
}) {
  const player = useMusicPlayer();
  const queryClient = useQueryClient();
  const [memory, setMemory] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const offline = useConnectionState() === "offline";
  const history = useQuery({ queryKey: musicKeys.songHistory(), queryFn: apiSongHistory });
  const home = useQuery({ queryKey: musicKeys.home(), queryFn: apiMusicHome });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: musicKeys.all });

  const favorite = useMutation({
    mutationFn: async () => {
      if (offline) {
        await queueMusicMutation({ kind: "favorite", trackId: track.id, favorited: !track.favorited });
        return;
      }
      await apiPatchFavorite(track.id, !track.favorited);
    },
    onSuccess: invalidate,
  });

  async function patchLibrary(scope: "personal" | "shared", saved: boolean) {
    if (offline) {
      await queueMusicMutation({ kind: "library", trackId: track.id, scope, saved });
      return;
    }
    await apiPatchLibrary(track.id, scope, saved);
    await invalidate();
  }

  return (
    <div data-testid="music-track-detail" className="flex flex-col gap-4 pb-4">
      <button type="button" className="text-accent self-start min-h-11 text-sm font-semibold" onClick={onBack}>
        Back
      </button>
      <div className="flex flex-col items-center text-center">
        <MusicArtwork src={track.artworkUrl} alt="" className="aspect-square w-[min(68vw,15.5rem)] rounded-[1.7rem]" />
        <h1 className="mt-3 text-xl font-semibold leading-tight">{track.title}</h1>
        <p className="text-secondary-text mt-1">{displayArtistName(track.artistName)}</p>
        {track.albumTitle ? <p className="text-muted-text mt-0.5 text-sm">{track.albumTitle}</p> : null}
        <p className="text-muted-text mt-2 text-xs">
          {track.savedShared ? "In Our Music" : track.savedPersonal ? "In your music" : "Not saved yet"}
          {track.savedByPartner ? ` · In ${partnerName}’s music` : ""}
        </p>
        <p className="text-muted-text mt-1 text-xs" data-testid="music-added-by">
          Added by {track.createdBy === userId ? userName : partnerName}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <ShhhButton onClick={() => player.playQueue([toQueueItem(track)])}>Play</ShhhButton>
        <ShhhIconButton
          label={track.favorited ? "Loved" : "Love"}
          data-testid="music-love"
          onClick={() => favorite.mutate()}
        >
          <Heart className={`size-5 ${track.favorited ? "fill-current" : ""}`} />
        </ShhhIconButton>
        <ShhhIconButton
          label="Send to Chat"
          data-testid="music-send-chat"
          onClick={() =>
            void apiSendMusicMessage({ trackId: track.id, clientGeneratedId: crypto.randomUUID() })
          }
        >
          <Share2 className="size-5" />
        </ShhhIconButton>
        <ShhhIconButton
          label="Recommend"
          data-testid="music-recommend"
          disabled={offline}
          onClick={() => {
            if (offline) return;
            void apiRecommendTrack(track.id, undefined, crypto.randomUUID()).then(invalidate);
          }}
        >
          <Sparkles className="size-5" />
        </ShhhIconButton>
        <ShhhIconButton label="More" data-testid="music-track-more" onClick={() => setMoreOpen(true)}>
          <MoreHorizontal className="size-5" />
        </ShhhIconButton>
      </div>

      <section>
        <h2 className="text-sm font-semibold">In our music</h2>
        <p className="text-secondary-text mt-1 text-sm">
          {track.savedShared
            ? "This lives in Our Music."
            : track.savedPersonal
              ? "Saved in your library."
              : "Not in a library yet — add it from More."}
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Memories</h2>
        <ul className="mt-2 space-y-2">
          {memories.map((item) => (
            <li key={item.id} className="bg-bg-soft rounded-[1.2rem] px-4 py-3 text-sm" dir="auto">
              <span className="text-secondary-text block text-xs">
                {item.authorId === userId ? userName : partnerName}
              </span>
              {item.text}
            </li>
          ))}
        </ul>
        <form
          className="mt-3 grid gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const clientGeneratedId = crypto.randomUUID();
            if (offline) {
              await queueMusicMutation({ kind: "memory", trackId: track.id, text: memory, clientGeneratedId });
            } else {
              await apiAddMemory(track.id, memory, clientGeneratedId);
            }
            setMemory("");
            void invalidate();
          }}
        >
          <ShhhInput
            value={memory}
            onChange={(event) => setMemory(event.target.value)}
            placeholder="A memory with this song"
            dir="auto"
            data-testid="music-memory-input"
          />
          <ShhhButton type="submit">Save memory</ShhhButton>
        </form>
      </section>

      {history.data?.history?.length ? (
        <section>
          <h2 className="text-sm font-semibold">Past songs</h2>
          <p className="text-muted-text mt-1 text-xs">Quiet history of our song right now.</p>
          <ul className="mt-2 space-y-1">
            {history.data.history.slice(0, 8).map((item) => (
              <li key={item.id} className="text-secondary-text text-sm">
                {item.track.title}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ShhhSheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <div className="grid gap-2">
          <ShhhButton
            variant="secondary"
            onClick={() => {
              setMoreOpen(false);
              void patchLibrary("personal", !track.savedPersonal);
            }}
            data-testid="music-save-mine"
          >
            {track.savedPersonal ? "✓ In My Music" : "Add to My Music"}
          </ShhhButton>
          <ShhhButton
            variant="secondary"
            onClick={() => {
              setMoreOpen(false);
              void patchLibrary("shared", !track.savedShared);
            }}
            data-testid="music-save-ours"
          >
            {track.savedShared ? "✓ In Our Music" : "Add to Our Music"}
          </ShhhButton>
          {home.data?.home.playlists[0] && !offline ? (
            <ShhhButton
              variant="ghost"
              onClick={() => {
                setMoreOpen(false);
                void apiAddToPlaylist(home.data!.home.playlists[0]!.id, track.id).then(invalidate);
              }}
            >
              Add to {home.data.home.playlists[0].title}
            </ShhhButton>
          ) : null}
          <ShhhButton
            variant="ghost"
            onClick={() => {
              setMoreOpen(false);
              onClip();
            }}
            data-testid="music-send-clip"
          >
            Send a clip
          </ShhhButton>
          <ShhhButton
            variant="ghost"
            disabled={offline}
            data-testid="music-song-of-moment"
            onClick={() => {
              setMoreOpen(false);
              void apiSetSongOfMoment(track.id).then(invalidate);
            }}
          >
            {track.isSongOfMoment ? "This is our song right now" : "Set as our song right now"}
          </ShhhButton>
        </div>
        <div className="mt-4">
          <h2 className="text-sm font-semibold">Sources</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {track.sources.map((source) => (
              <a
                key={source.id}
                href={source.canonicalUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-bg-soft inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold"
              >
                {sourceLabel(source.provider)}
              </a>
            ))}
          </div>
        </div>
        {track.sources.filter((source) => source.provider === "youtube" || source.provider === "youtube_music").length >
        1 ? (
          <div className="mt-4">
            <h2 className="text-sm font-semibold">Playback version</h2>
            <div className="mt-2 grid gap-2">
              {track.sources
                .filter((source) => source.provider === "youtube" || source.provider === "youtube_music")
                .map((source) => (
                  <ShhhButton
                    key={source.id}
                    variant={source.externalId === track.youtubeVideoId ? "primary" : "secondary"}
                    disabled={offline || !source.externalId}
                    onClick={() => source.externalId && apiSetPlayback(track.id, source.externalId).then(invalidate)}
                  >
                    Use this YouTube version
                  </ShhhButton>
                ))}
            </div>
          </div>
        ) : null}
      </ShhhSheet>
    </div>
  );
}
