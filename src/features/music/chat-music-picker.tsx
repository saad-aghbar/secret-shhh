"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { ShhhButton, ShhhInput, ShhhSheet } from "@/components/shhh";
import { ClipSelectorSheet } from "@/features/music/clip-selector-sheet";
import { MusicArtwork } from "@/features/music/music-artwork";
import { musicKeys } from "@/features/music/query-keys";
import { useConnectionState } from "@/lib/connection/use-connection-state";
import {
  apiMusicHome,
  apiResolveMusic,
  apiSaveTrack,
  apiSearchMusic,
  apiSendMusicMessage,
} from "@/lib/music/client-api";
import { displayArtistName } from "@/lib/music/copy";
import type { MusicTrackDto } from "@/lib/music/types";

type PickerItem = {
  id?: string;
  title: string;
  artistName: string;
  artworkUrl: string | null;
  durationMs: number | null;
  youtubeVideoId: string | null;
  url?: string;
};

function fromTrack(track: MusicTrackDto): PickerItem {
  return {
    id: track.id,
    title: track.title,
    artistName: track.artistName,
    artworkUrl: track.artworkUrl,
    durationMs: track.durationMs,
    youtubeVideoId: track.youtubeVideoId,
  };
}

function toStubTrack(item: PickerItem, id: string): MusicTrackDto {
  return {
    id,
    title: item.title,
    artistName: item.artistName,
    albumTitle: null,
    albumArtist: null,
    artworkUrl: item.artworkUrl,
    durationMs: item.durationMs,
    releaseYear: null,
    isrc: null,
    youtubeVideoId: item.youtubeVideoId,
    youtubePlayable: Boolean(item.youtubeVideoId),
    createdBy: "",
    createdAt: new Date().toISOString(),
    sources: [],
    savedPersonal: false,
    savedShared: false,
    savedByPartner: false,
    favorited: false,
    partnerFavorited: false,
    lovedByBoth: false,
    isSongOfMoment: false,
  };
}

export function ChatMusicPicker({
  open,
  onClose,
  partnerName,
  initialUrl,
}: {
  open: boolean;
  onClose: () => void;
  partnerName: string;
  initialUrl?: string;
}) {
  const offline = useConnectionState() === "offline";
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState(initialUrl ?? "");
  const [selected, setSelected] = useState<PickerItem | null>(null);
  const [clipTrack, setClipTrack] = useState<MusicTrackDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const home = useQuery({
    queryKey: musicKeys.home(),
    queryFn: apiMusicHome,
    enabled: open,
  });
  const search = useQuery({
    queryKey: musicKeys.search(query),
    queryFn: () => apiSearchMusic(query, true),
    enabled: open && query.trim().length > 1,
  });

  const resolve = useMutation({
    mutationFn: (nextUrl: string) => apiResolveMusic(nextUrl),
    onSuccess: (data) => {
      setError(null);
      setSelected({
        id: data.preview.existingTrackId ?? undefined,
        title: data.preview.metadata.title,
        artistName: data.preview.metadata.artistName ?? "",
        artworkUrl: data.preview.metadata.artworkUrl,
        durationMs: data.preview.metadata.durationMs,
        youtubeVideoId: data.preview.match.selectedVideoId ?? data.preview.metadata.youtubeVideoId,
        url: data.preview.metadata.canonicalUrl || url,
      });
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Couldn’t find that song."),
  });

  async function ensureTrack(item: PickerItem) {
    if (item.id) return item.id;
    const saved = await apiSaveTrack({
      url: item.url,
      youtubeVideoId: item.youtubeVideoId ?? undefined,
    });
    return saved.track.id;
  }

  async function sendSong() {
    if (!selected || offline) return;
    try {
      const trackId = await ensureTrack(selected);
      await apiSendMusicMessage({ trackId, clientGeneratedId: crypto.randomUUID() });
      closeAll();
    } catch {
      setError("Couldn’t send that song.");
    }
  }

  async function shareClip() {
    if (!selected || offline) return;
    try {
      const trackId = await ensureTrack(selected);
      setClipTrack(toStubTrack(selected, trackId));
    } catch {
      setError("Couldn’t open the clip picker.");
    }
  }

  function closeAll() {
    setSelected(null);
    setQuery("");
    setUrl("");
    setError(null);
    onClose();
  }

  /* eslint-disable react-hooks/set-state-in-effect -- prefills a pasted link when the picker opens */
  useEffect(() => {
    if (!open || !initialUrl) return;
    setUrl(initialUrl);
    resolve.mutate(initialUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolve once per open+url
  }, [open, initialUrl]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const dto = home.data?.home;
  const searching = query.trim().length > 1;
  const sections = useMemo(() => {
    if (!dto) return [];
    const unique = (tracks: MusicTrackDto[]) => {
      const seen = new Set<string>();
      return tracks.filter((track) => {
        if (!track.id || seen.has(track.id)) return false;
        seen.add(track.id);
        return true;
      });
    };
    return [
      { key: "ours", title: "Our Songs", tracks: unique(dto.ourSongs) },
      { key: "for-you", title: "For You", tracks: unique(dto.forYou.map((item) => item.track)) },
      { key: "recent", title: "Recently Added", tracks: unique(dto.recentlyAdded) },
      { key: "mine", title: "My Music", tracks: unique(dto.myMusic) },
      { key: "partner", title: `${partnerName}’s Music`, tracks: unique(dto.partnerMusic) },
    ].filter((section) => section.tracks.length > 0);
  }, [dto, partnerName]);

  return (
    <>
      <ShhhSheet
        open={open && !clipTrack}
        onClose={closeAll}
        title={selected ? selected.title : "Send music"}
        className="max-h-[min(92dvh,44rem)]"
        footer={
          selected ? (
            <div className="grid gap-2">
              <ShhhButton data-testid="chat-music-send-song" disabled={offline} onClick={() => void sendSong()}>
                Send song
              </ShhhButton>
              <ShhhButton
                variant="secondary"
                data-testid="chat-music-share-clip"
                disabled={offline}
                onClick={() => void shareClip()}
              >
                Share a clip
              </ShhhButton>
            </div>
          ) : null
        }
      >
        {selected ? (
          <div className="pb-2" data-testid="chat-music-picker">
            <button
              type="button"
              className="text-accent mb-4 min-h-11 text-sm font-semibold"
              onClick={() => setSelected(null)}
            >
              Back
            </button>
            <div className="flex items-center gap-3" data-testid="chat-music-selected">
              <MusicArtwork src={selected.artworkUrl} alt="" size="md" />
              <div className="min-w-0">
                <p className="truncate font-semibold">{selected.title}</p>
                <p className="text-secondary-text truncate text-sm">
                  {displayArtistName(selected.artistName)}
                </p>
              </div>
            </div>
            {error ? <p className="text-danger mt-3 text-sm">{error}</p> : null}
            {offline ? (
              <p className="text-secondary-text mt-3 text-sm">You’re offline — send when you’re back.</p>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-5 pb-2" data-testid="chat-music-picker">
            <ShhhInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search music"
              aria-label="Search music"
              data-testid="chat-music-search"
            />
            {searching ? (
              <div className="grid gap-1">
                {search.data?.local?.map((track) => (
                  <PickerRow key={track.id} item={fromTrack(track)} onSelect={setSelected} />
                ))}
                {search.data?.youtube?.length ? (
                  <div data-testid="music-youtube-results">
                    <p className="text-secondary-text mb-1 text-xs font-semibold">From YouTube</p>
                    {search.data.youtube.map((hit) => (
                      <PickerRow
                        key={hit.videoId}
                        item={{
                          title: hit.title,
                          artistName: hit.channelTitle,
                          artworkUrl: hit.artworkUrl,
                          durationMs: hit.durationMs,
                          youtubeVideoId: hit.videoId,
                          url: `https://www.youtube.com/watch?v=${hit.videoId}`,
                        }}
                        onSelect={setSelected}
                      />
                    ))}
                  </div>
                ) : null}
                {search.data &&
                !search.data.youtubeSearchConfigured &&
                !search.data.local?.length ? (
                  <p className="text-secondary-text text-sm">
                    YouTube search isn’t configured. Paste a link instead.
                  </p>
                ) : null}
              </div>
            ) : (
              sections.map((section) => (
                <section key={section.key}>
                  <h3 className="text-secondary-text mb-1 text-xs font-semibold tracking-wide uppercase">
                    {section.title}
                  </h3>
                  {section.tracks.slice(0, 6).map((track) => (
                    <PickerRow key={`${section.key}-${track.id}`} item={fromTrack(track)} onSelect={setSelected} />
                  ))}
                </section>
              ))
            )}
            <form
              className="grid gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (url.trim()) resolve.mutate(url);
              }}
            >
              <p className="text-secondary-text text-xs font-semibold tracking-wide uppercase">
                Paste a link
              </p>
              <ShhhInput
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="Spotify, Apple Music, or YouTube"
                aria-label="Paste a music link"
                data-testid="chat-music-url"
              />
              <ShhhButton
                type="submit"
                variant="secondary"
                disabled={!url.trim() || offline || resolve.isPending}
                data-testid="chat-music-resolve"
              >
                Look up
              </ShhhButton>
            </form>
            {error && !selected ? <p className="text-danger text-sm">{error}</p> : null}
          </div>
        )}
      </ShhhSheet>
      <ClipSelectorSheet
        open={Boolean(clipTrack)}
        track={clipTrack}
        onClose={() => setClipTrack(null)}
        onSent={closeAll}
      />
    </>
  );
}

function PickerRow({ item, onSelect }: { item: PickerItem; onSelect: (item: PickerItem) => void }) {
  return (
    <button
      type="button"
      className="flex min-h-11 w-full items-center gap-3 rounded-[1.15rem] py-1.5 pe-2 text-start hover:bg-accent-soft/40"
      data-testid="chat-music-row"
      onClick={() => onSelect(item)}
    >
      <MusicArtwork src={item.artworkUrl} alt="" size="sm" className="rounded-[0.9rem]" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{item.title}</span>
        <span className="text-secondary-text block truncate text-xs">
          {displayArtistName(item.artistName)}
        </span>
      </span>
    </button>
  );
}
