"use client";

import { MusicTrackRow } from "@/features/music/music-track-row";
import { MusicArtwork } from "@/features/music/music-artwork";
import { useMusicPlayer } from "@/features/music/music-player-provider";
import { musicKeys } from "@/features/music/query-keys";
import { toQueueItem } from "@/lib/music/player/queue";
import { apiCreatePlaylist } from "@/lib/music/client-api";
import type { MusicAlbumGroupDto, MusicArtistGroupDto, MusicHomeDto } from "@/lib/music/types";
import { useQueryClient } from "@tanstack/react-query";

export function MusicBrowseView({
  view,
  home,
  albums,
  artists,
  onOpenTrack,
  onOpenPlaylist,
}: {
  view: string;
  home: MusicHomeDto;
  albums: MusicAlbumGroupDto[];
  artists: MusicArtistGroupDto[];
  onOpenTrack: (id: string) => void;
  onOpenPlaylist: (id: string) => void;
}) {
  const player = useMusicPlayer();
  const queryClient = useQueryClient();
  if (view === "songs") {
    return (
      <div>
        {home.ourSongs.map((track, index) => (
          <MusicTrackRow
            key={track.id}
            track={track}
            onOpen={() => onOpenTrack(track.id)}
            onPlay={() => player.playQueue(home.ourSongs.map((item) => toQueueItem(item)), index)}
          />
        ))}
      </div>
    );
  }
  if (view === "playlists") {
    return (
      <div>
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="bg-accent-soft text-accent min-h-11 rounded-full px-4 text-sm font-semibold"
            data-testid="music-create-shared-playlist"
            onClick={async () => {
              const created = await apiCreatePlaylist("Ours", true);
              await queryClient.invalidateQueries({ queryKey: musicKeys.all });
              if (created.playlist?.id) onOpenPlaylist(created.playlist.id);
            }}
          >
            Shared playlist
          </button>
          <button
            type="button"
            className="bg-bg-soft min-h-11 rounded-full px-4 text-sm font-semibold"
            data-testid="music-create-personal-playlist"
            onClick={async () => {
              const created = await apiCreatePlaylist("Just mine", false);
              await queryClient.invalidateQueries({ queryKey: musicKeys.all });
              if (created.playlist?.id) onOpenPlaylist(created.playlist.id);
            }}
          >
            Personal playlist
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {home.playlists.map((playlist) => (
            <button
              key={playlist.id}
              type="button"
              className="flex items-center gap-3 text-start"
              data-testid="music-playlist-card"
              onClick={() => onOpenPlaylist(playlist.id)}
            >
              <MusicArtwork src={playlist.coverArtworkUrl} alt="" size="md" className="rounded-[1.2rem]" />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{playlist.title}</span>
                <span className="text-secondary-text text-xs">
                  {playlist.collaborative ? "Ours" : "Personal"} · {playlist.trackCount} songs
                </span>
                {playlist.note ? (
                  <span className="text-muted-text mt-0.5 block truncate text-xs" dir="auto">
                    {playlist.note}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (view === "albums") {
    return (
      <div className="grid gap-5">
        {albums.map((album) => (
          <section key={`${album.albumTitle}-${album.albumArtist}`}>
            <div className="mb-2 flex items-center gap-3">
              <MusicArtwork src={album.artworkUrl} alt="" size="md" />
              <div>
                <h2 className="font-semibold">{album.albumTitle}</h2>
                <p className="text-secondary-text text-sm">{album.albumArtist}</p>
              </div>
            </div>
            {album.tracks.map((track, index) => (
              <MusicTrackRow
                key={track.id}
                track={track}
                compact
                onOpen={() => onOpenTrack(track.id)}
                onPlay={() => player.playQueue(album.tracks.map((item) => toQueueItem(item)), index)}
              />
            ))}
          </section>
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-5">
      {artists.map((artist) => (
        <section key={artist.artistName}>
          <h2 className="mb-2 font-semibold">{artist.artistName}</h2>
          {artist.tracks.map((track, index) => (
            <MusicTrackRow
              key={track.id}
              track={track}
              compact
              onOpen={() => onOpenTrack(track.id)}
              onPlay={() => player.playQueue(artist.tracks.map((item) => toQueueItem(item)), index)}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
