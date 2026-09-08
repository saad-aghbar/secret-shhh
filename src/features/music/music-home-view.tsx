"use client";

import { ShhhButton, ShhhEmptyState } from "@/components/shhh";
import { MusicArtwork } from "@/features/music/music-artwork";
import { MusicTrackRow } from "@/features/music/music-track-row";
import { useMusicPlayer } from "@/features/music/music-player-provider";
import {
  activityKindCopy,
  displayArtistName,
  recommendationGiftCopy,
  recommendationStatusCopy,
  relativeDayLabel,
} from "@/lib/music/copy";
import { toQueueItem } from "@/lib/music/player/queue";
import type { MusicHomeDto, MusicPlaylistDto } from "@/lib/music/types";

type MusicHomeViewProps = {
  home: MusicHomeDto;
  filter: "ours" | "mine" | "partner";
  userId: string;
  userName: string;
  partnerName: string;
  partnerId: string | null;
  onOpenTrack: (id: string) => void;
  onOpenPlaylist: (id: string) => void;
  onOpenRecommendations: () => void;
  onCreatePlaylist: () => void;
  onBrowse: () => void;
};

export function MusicHomeView({
  home,
  filter,
  userId,
  userName,
  partnerName,
  onOpenTrack,
  onOpenPlaylist,
  onOpenRecommendations,
  onCreatePlaylist,
  onBrowse,
}: MusicHomeViewProps) {
  const player = useMusicPlayer();
  const songs =
    filter === "mine" ? home.myMusic : filter === "partner" ? home.partnerMusic : home.ourSongs;
  const empty =
    !home.songOfMoment &&
    home.forYou.length === 0 &&
    home.ourSongs.length === 0 &&
    home.playlists.length === 0 &&
    home.myMusic.length === 0 &&
    home.partnerMusic.length === 0;

  if (empty) {
    return (
      <div data-testid="music-empty">
        <ShhhEmptyState
          title="Start our soundtrack"
          description="Add a song you both love, recommend one, or make a playlist."
        />
        <div className="mx-auto mt-4 grid max-w-sm gap-2">
          <ShhhButton onClick={() => player.openAdd()} data-testid="music-empty-add">
            Add a song
          </ShhhButton>
          <ShhhButton variant="secondary" onClick={() => player.openAdd()}>
            Recommend
          </ShhhButton>
          <ShhhButton variant="ghost" onClick={onCreatePlaylist} data-testid="music-create-playlist">
            Make a playlist
          </ShhhButton>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7 pb-6">
      {home.songOfMoment ? (
        <section data-testid="song-of-the-moment">
          <SectionTitle>Our song right now</SectionTitle>
          <button
            type="button"
            className="mt-2.5 flex w-full items-center gap-3 rounded-[1.6rem] bg-accent-soft/35 p-2.5 text-start"
            onClick={() => {
              player.playQueue([toQueueItem(home.songOfMoment!.track)]);
              onOpenTrack(home.songOfMoment!.track.id);
            }}
          >
            <MusicArtwork src={home.songOfMoment.track.artworkUrl} alt="" size="md" className="rounded-[1.2rem]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-semibold">{home.songOfMoment.track.title}</span>
              <span className="text-secondary-text mt-0.5 block truncate text-sm">
                {displayArtistName(home.songOfMoment.track.artistName)}
              </span>
              <span className="text-muted-text mt-1 block text-xs">
                Set by {home.songOfMoment.setBy === userId ? "you" : partnerName}
              </span>
            </span>
            <span className="font-handmade text-love text-lg leading-none" aria-hidden>
              ♡
            </span>
          </button>
        </section>
      ) : (
        <section data-testid="song-of-the-moment-invite">
          <p className="text-secondary-text text-sm">No song of the moment yet — set one from a track you both love.</p>
        </section>
      )}

      {home.forYou.length > 0 ? (
        <section data-testid="for-you">
          <div className="flex items-center justify-between">
            <SectionTitle>For You</SectionTitle>
            <button type="button" className="text-accent min-h-11 text-sm font-semibold" onClick={onOpenRecommendations}>
              See all
            </button>
          </div>
          <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
            {uniqueRecommendations(home.forYou).slice(0, 8).map((item, index) => (
              <article
                key={item.id}
                className="w-40 shrink-0 rounded-[1.4rem] bg-love-soft/40 p-2.5"
                data-testid="for-you-card"
              >
                <p className="text-muted-text mb-2 text-[11px] font-semibold tracking-wide uppercase">
                  For you ♡
                </p>
                <button
                  type="button"
                  className="w-full text-start"
                  onClick={() =>
                    player.playQueue(
                      uniqueRecommendations(home.forYou).map((entry) =>
                        toQueueItem(entry.track, { recommendationId: entry.id }),
                      ),
                      index,
                    )
                  }
                  onDoubleClick={() => onOpenTrack(item.track.id)}
                >
                  <MusicArtwork src={item.track.artworkUrl} alt="" className="aspect-square w-full rounded-[1.1rem]" />
                  <span className="mt-2 block truncate text-sm font-semibold">{item.track.title}</span>
                  <span className="text-secondary-text block truncate text-xs">
                    {displayArtistName(item.track.artistName)}
                  </span>
                </button>
                <p className="text-muted-text mt-1.5 text-xs leading-snug">
                  {recommendationGiftCopy(partnerName, item.senderId === userId)}
                </p>
                <p className="text-secondary-text mt-0.5 text-xs">
                  {recommendationStatusCopy(item.status, item.senderId === userId)}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {songs.length > 0 ? (
        <section data-testid="our-songs">
          <SectionTitle>
            {filter === "mine" ? `${userName}’s Music` : filter === "partner" ? `${partnerName}’s Music` : "Our Songs"}
          </SectionTitle>
          <div className="mt-1">
            {songs.slice(0, 8).map((track) => (
              <MusicTrackRow
                key={`${filter}-${track.id}`}
                track={track}
                compact
                onOpen={() => onOpenTrack(track.id)}
                onPlay={() =>
                  player.playQueue(
                    songs.map((item) => toQueueItem(item)),
                    songs.findIndex((item) => item.id === track.id),
                  )
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      {home.playlists.length > 0 ? (
        <section>
          <SectionTitle>Playlists</SectionTitle>
          <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
            {home.playlists.map((playlist) => (
              <PlaylistCard
                key={playlist.id}
                playlist={playlist}
                shared={playlist.collaborative}
                onOpen={() => onOpenPlaylist(playlist.id)}
              />
            ))}
          </div>
        </section>
      ) : (
        <ShhhButton variant="ghost" className="self-start" onClick={onCreatePlaylist} data-testid="music-create-playlist">
          Make a playlist
        </ShhhButton>
      )}

      {filter === "ours" && home.lovedByBoth.length > 0 ? (
        <section data-testid="loved-by-both">
          <SectionTitle>Loved by Both</SectionTitle>
          <div className="mt-1">
            {home.lovedByBoth.slice(0, 6).map((track, index) => (
              <MusicTrackRow
                key={`loved-${track.id}`}
                track={track}
                compact
                onOpen={() => onOpenTrack(track.id)}
                onPlay={() =>
                  player.playQueue(
                    home.lovedByBoth.map((item) => toQueueItem(item)),
                    index,
                  )
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      {filter === "ours" && home.recentlyAdded.length > 0 ? (
        <section>
          <SectionTitle>Recently Added</SectionTitle>
          <div className="mt-1">
            {home.recentlyAdded.slice(0, 6).map((track, index) => (
              <MusicTrackRow
                key={`recent-${track.id}`}
                track={track}
                compact
                onOpen={() => onOpenTrack(track.id)}
                onPlay={() =>
                  player.playQueue(
                    home.recentlyAdded.map((item) => toQueueItem(item)),
                    index,
                  )
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <button
          type="button"
          className="text-secondary-text hover:text-primary-text min-h-11 text-sm font-semibold"
          data-testid="music-browse-entry"
          onClick={onBrowse}
        >
          Browse Music
        </button>
      </section>

      {home.activity.length > 0 ? (
        <section data-testid="music-activity">
          <SectionTitle>Recently</SectionTitle>
          <ul className="mt-2 space-y-2">
            {home.activity.map((item) => (
              <li key={item.id} className="text-secondary-text text-sm">
                <span className="text-primary-text font-medium">
                  {item.actorId === userId ? userName : partnerName}
                </span>{" "}
                {activityKindCopy(item.kind)}
                {item.trackTitle ? ` · ${item.trackTitle}` : ""}
                <span className="text-muted-text"> · {relativeDayLabel(item.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function uniqueRecommendations(items: MusicHomeDto["forYou"]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.track.id)) return false;
    seen.add(item.track.id);
    return true;
  });
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold tracking-tight text-primary-text">{children}</h2>;
}

function PlaylistCard({
  playlist,
  shared,
  onOpen,
}: {
  playlist: MusicPlaylistDto;
  shared: boolean;
  onOpen: () => void;
}) {
  return (
    <button type="button" className="w-36 shrink-0 text-start" onClick={onOpen} data-testid="music-playlist-card">
      <MusicArtwork src={playlist.coverArtworkUrl} alt="" className="aspect-square w-36 rounded-[1.35rem]" />
      <span className="mt-2 block truncate text-sm font-semibold">{playlist.title}</span>
      <span className="text-secondary-text text-xs">
        {shared ? "Ours" : "Personal"} · {playlist.trackCount} songs
      </span>
      {playlist.note ? (
        <span className="text-muted-text mt-0.5 block truncate text-xs" dir="auto">
          {playlist.note}
        </span>
      ) : null}
    </button>
  );
}
