"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Shuffle } from "lucide-react";
import { useState } from "react";

import { ShhhButton } from "@/components/shhh";
import { MusicArtwork } from "@/features/music/music-artwork";
import { MusicTrackRow } from "@/features/music/music-track-row";
import { useMusicPlayer } from "@/features/music/music-player-provider";
import { musicKeys } from "@/features/music/query-keys";
import { apiGetPlaylist, apiRemovePlaylistTrack, apiReorderPlaylist } from "@/lib/music/client-api";
import { canEditPlaylist, playlistOwnershipCopy } from "@/lib/music/copy";
import { useConnectionState } from "@/lib/connection/use-connection-state";
import { toQueueItem } from "@/lib/music/player/queue";

export function MusicPlaylistDetail({
  playlistId,
  userId,
  userName,
  partnerName,
  onBack,
  onOpenTrack,
}: {
  playlistId: string;
  userId: string;
  userName: string;
  partnerName: string;
  onBack: () => void;
  onOpenTrack: (id: string) => void;
}) {
  const player = useMusicPlayer();
  const queryClient = useQueryClient();
  const offline = useConnectionState() === "offline";
  const query = useQuery({
    queryKey: musicKeys.playlist(playlistId),
    queryFn: () => apiGetPlaylist(playlistId),
  });
  const playlist = query.data?.playlist;
  const [order, setOrder] = useState<string[] | null>(null);

  const reorder = useMutation({
    mutationFn: (trackIds: string[]) => apiReorderPlaylist(playlistId, trackIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: musicKeys.playlist(playlistId) }),
  });

  if (!playlist) {
    return <p className="text-secondary-text text-sm">Loading playlist…</p>;
  }

  const ids = order ?? playlist.tracks.map((track) => track.id);
  const tracks = ids.flatMap((id) => playlist.tracks.filter((track) => track.id === id));
  const canEdit = canEditPlaylist(playlist, userId);

  function move(index: number, delta: number) {
    const next = [...ids];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setOrder(next);
    if (!offline) reorder.mutate(next);
  }

  return (
    <div data-testid="music-playlist-detail">
      <button type="button" className="text-accent mb-4 text-sm font-semibold" onClick={onBack}>
        Back
      </button>
      <div className="flex items-center gap-4">
        <MusicArtwork src={playlist.coverArtworkUrl} alt="" size="lg" className="rounded-[1.5rem]" />
        <div>
          <h1 className="text-2xl font-semibold">{playlist.title}</h1>
          <p className="text-secondary-text mt-1 text-sm">
            {playlistOwnershipCopy({
              collaborative: playlist.collaborative,
              ownerId: playlist.ownerId,
              viewerId: userId,
              viewerName: userName,
              partnerName,
            })}
          </p>
          {playlist.note ? (
            <p className="mt-2 text-sm" dir="auto">
              {playlist.note}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <ShhhButton
          variant="secondary"
          onClick={() => player.playQueue(tracks.map((item) => toQueueItem(item)))}
        >
          Play
        </ShhhButton>
        <ShhhButton
          variant="secondary"
          onClick={() => {
            player.playQueue(tracks.map((item) => toQueueItem(item)));
            player.setShuffle(true);
          }}
        >
          <Shuffle className="size-4" /> Shuffle
        </ShhhButton>
      </div>
      {offline && canEdit ? (
        <p className="text-secondary-text mt-3 text-sm">Reorder needs a connection.</p>
      ) : null}
      <div className="mt-4">
        {tracks.map((track, index) => (
          <div key={track.id} className="flex min-w-0 items-center gap-1">
            <div className="min-w-0 flex-1">
            <MusicTrackRow
              track={track}
              compact
              onOpen={() => onOpenTrack(track.id)}
              onPlay={() => player.playQueue(tracks.map((item) => toQueueItem(item)), index)}
            />
            </div>
            {canEdit && !offline ? (
              <div className="flex flex-col">
                <button type="button" aria-label="Move up" className="size-9 grid place-items-center" onClick={() => move(index, -1)}>
                  <ArrowUp className="size-4" />
                </button>
                <button type="button" aria-label="Move down" className="size-9 grid place-items-center" onClick={() => move(index, 1)}>
                  <ArrowDown className="size-4" />
                </button>
              </div>
            ) : null}
            {canEdit && !offline ? (
              <button
                type="button"
                className="text-muted-text px-2 text-xs"
                onClick={() => apiRemovePlaylistTrack(playlistId, track.id).then(() => query.refetch())}
              >
                Remove
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
