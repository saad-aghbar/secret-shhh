"use client";

import { Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ShhhEmptyState, ShhhIconButton } from "@/components/shhh";
import { ClipSelectorSheet } from "@/features/music/clip-selector-sheet";
import { MusicHomeView } from "@/features/music/music-home-view";
import { MusicPlaylistDetail } from "@/features/music/music-playlist-detail";
import { MusicRecommendationsView } from "@/features/music/music-recommendations-view";
import { MusicTrackDetail } from "@/features/music/music-track-detail";
import { MusicBrowseView } from "@/features/music/music-browse-view";
import { useMusicPlayer } from "@/features/music/music-player-provider";
import { musicKeys } from "@/features/music/query-keys";
import { useMusicRealtime } from "@/features/music/use-music-realtime";
import { cacheMusicSnapshot, flushPendingMusicMutations } from "@/lib/music/offline";
import { apiAlbums, apiArtists, apiCreatePlaylist, apiGetTrack, apiMusicHome } from "@/lib/music/client-api";
import { connectionManager } from "@/lib/connection/manager";
import type { MusicTrackDto } from "@/lib/music/types";
import { cn } from "@/lib/utils";

type MusicExperienceProps = {
  conversationId: string;
  userId: string;
  userName: string;
  partnerId: string | null;
  partnerName: string;
  shareUrl?: string | null;
};

export function MusicExperience({
  conversationId,
  userId,
  userName,
  partnerId,
  partnerName,
  shareUrl,
}: MusicExperienceProps) {
  const searchParams = useSearchParams();
  const player = useMusicPlayer();
  const queryClient = useQueryClient();
  const [clipTrack, setClipTrack] = useState<MusicTrackDto | null>(null);
  useMusicRealtime(conversationId);

  const homeQuery = useQuery({
    queryKey: musicKeys.home(),
    queryFn: apiMusicHome,
    staleTime: 4_000,
  });

  useEffect(() => {
    if (homeQuery.data) {
      void cacheMusicSnapshot({
        tracks: [
          ...homeQuery.data.home.ourSongs,
          ...homeQuery.data.home.myMusic,
          ...homeQuery.data.home.partnerMusic,
          ...homeQuery.data.home.lovedByBoth,
          ...homeQuery.data.home.recentlyAdded,
        ],
        playlists: homeQuery.data.home.playlists,
        recommendations: [...homeQuery.data.home.forYou, ...homeQuery.data.home.sentByMe],
      });
    }
  }, [homeQuery.data]);

  useEffect(() => {
    return connectionManager.subscribe((state) => {
      if (state === "online" || state === "poor") {
        void flushPendingMusicMutations().then(() => homeQuery.refetch());
      }
    });
  }, [homeQuery]);

  useEffect(() => {
    if (shareUrl) {
      player.openAdd(shareUrl);
    }
    if (searchParams.get("add") === "1") {
      player.openAdd(searchParams.get("url") ?? shareUrl ?? undefined);
    }
    // open once on mount / share
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setParams = useCallback((patch: Record<string, string | null>, history: "replace" | "push" = "replace") => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    const href = qs ? `/music?${qs}` : "/music";
    if (history === "push") window.history.pushState(null, "", href);
    else window.history.replaceState(null, "", href);
  }, [searchParams]);

  const view = searchParams.get("view") ?? "home";
  const browsing = view === "songs" || view === "playlists" || view === "albums" || view === "artists";
  const filter = (searchParams.get("filter") as "ours" | "mine" | "partner") || "ours";
  const trackId = searchParams.get("track");
  const playlistId = searchParams.get("playlist");
  const showingDetail = Boolean(trackId || playlistId || view === "recommendations");

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [trackId, playlistId, view]);

  const trackQuery = useQuery({
    queryKey: musicKeys.track(trackId ?? ""),
    queryFn: () => apiGetTrack(trackId!),
    enabled: Boolean(trackId),
  });
  const albumsQuery = useQuery({
    queryKey: musicKeys.albums(),
    queryFn: apiAlbums,
    enabled: view === "albums",
  });
  const artistsQuery = useQuery({
    queryKey: musicKeys.artists(),
    queryFn: apiArtists,
    enabled: view === "artists",
  });

  const home = homeQuery.data?.home;
  const pills = useMemo(
    () =>
      [
        ["ours", "Ours"],
        ["mine", "Mine"],
        ["partner", partnerName],
      ] as const,
    [partnerName],
  );

  if (homeQuery.isLoading && !home) {
    return (
      <div className="flex flex-1 flex-col gap-6 py-2" data-testid="music-home">
        <div className="bg-bg-soft h-10 w-44 rounded-full" />
        <div className="flex gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="bg-bg-soft size-28 shrink-0 rounded-[1.2rem]" />
          ))}
        </div>
        <div className="bg-bg-soft h-14 rounded-[1.25rem]" />
        <div className="bg-bg-soft h-14 rounded-[1.25rem]" />
      </div>
    );
  }

  if (!home) {
    return (
      <div data-testid="music-home">
        <ShhhEmptyState title="Our Music" description="Couldn’t load your soundtrack. Try again in a moment." />
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            className="text-accent min-h-11 px-4 text-sm font-semibold"
            onClick={() => void homeQuery.refetch()}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-5" data-testid="music-home">
      {showingDetail ? null : (
        <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-handmade text-3xl tracking-tight text-primary-text">Our Music</p>
          <p className="text-secondary-text mt-1 text-sm">The soundtrack that’s just ours.</p>
        </div>
        <ShhhIconButton label="Add music" data-testid="music-add" onClick={() => player.openAdd()}>
          <Plus className="size-5" />
        </ShhhIconButton>
      </div>

      {browsing ? (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            className="text-accent self-start min-h-11 text-sm font-semibold"
            data-testid="music-browse-home"
            onClick={() => setParams({ view: null, track: null, playlist: null })}
          >
            Back
          </button>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(
              [
                ["songs", "Songs"],
                ["playlists", "Playlists"],
                ["albums", "Albums"],
                ["artists", "Artists"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={cn(
                  "min-h-10 shrink-0 rounded-full px-3.5 text-sm font-medium",
                  view === value ? "bg-accent-soft text-accent" : "bg-bg-soft text-secondary-text",
                )}
                data-testid={`music-browse-${value}`}
                onClick={() => setParams({ view: value, track: null, playlist: null })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : (
      <div className="flex flex-wrap gap-2">
        {pills.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={cn(
              "min-h-11 rounded-full px-4 text-sm font-semibold",
              filter === value ? "bg-accent-soft text-accent" : "bg-bg-soft text-secondary-text",
            )}
            data-testid={`music-filter-${value}`}
            onClick={() => setParams({ filter: value === "ours" ? null : value })}
          >
            {label}
          </button>
        ))}
      </div>
      )}
        </>
      )}

      {trackId ? (
        trackQuery.data ? (
        <MusicTrackDetail
          track={trackQuery.data.track}
          memories={trackQuery.data.memories}
          userId={userId}
          userName={userName}
          partnerName={partnerName}
          onBack={() => setParams({ track: null }, "replace")}
          onClip={() => setClipTrack(trackQuery.data.track)}
        />
        ) : (
          <p className="text-secondary-text text-sm">Loading song…</p>
        )
      ) : playlistId ? (
        <MusicPlaylistDetail
          playlistId={playlistId}
          userId={userId}
          userName={userName}
          partnerName={partnerName}
          onBack={() => setParams({ playlist: null })}
          onOpenTrack={(id) => setParams({ track: id }, "push")}
        />
      ) : view === "recommendations" ? (
        <MusicRecommendationsView
          incoming={home.forYou}
          sent={home.sentByMe}
          userId={userId}
          partnerName={partnerName}
          onBack={() => setParams({ view: null })}
          onOpenTrack={(id) => setParams({ track: id }, "push")}
        />
      ) : view === "home" ? (
        <MusicHomeView
          home={home}
          filter={filter}
          userId={userId}
          userName={userName}
          partnerName={partnerName}
          partnerId={partnerId}
          onOpenTrack={(id) => setParams({ track: id }, "push")}
          onOpenPlaylist={(id) => setParams({ playlist: id }, "push")}
          onOpenRecommendations={() => setParams({ view: "recommendations" }, "push")}
          onBrowse={() => setParams({ view: "songs" }, "push")}
          onCreatePlaylist={async () => {
            const created = await apiCreatePlaylist("Ours", true);
            if (created.playlist?.id) {
              await queryClient.invalidateQueries({ queryKey: musicKeys.all });
              setParams({ playlist: created.playlist.id }, "push");
            }
          }}
        />
      ) : (
        <MusicBrowseView
          view={view}
          home={home}
          albums={albumsQuery.data?.albums ?? []}
          artists={artistsQuery.data?.artists ?? []}
          onOpenTrack={(id) => setParams({ track: id }, "push")}
          onOpenPlaylist={(id) => setParams({ playlist: id }, "push")}
        />
      )}

      <ClipSelectorSheet open={Boolean(clipTrack)} track={clipTrack} onClose={() => setClipTrack(null)} />
    </div>
  );
}
