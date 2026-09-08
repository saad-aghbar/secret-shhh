"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { chatFocusHref } from "@/features/chat/focus-navigation";
import { PhotoViewer } from "@/features/chat/photo-viewer";
import { AddToAlbumSheet } from "@/features/media/add-to-album";
import { AlbumDetail } from "@/features/media/album-detail";
import { AlbumsHome } from "@/features/media/albums-home";
import { formatMediaTimestamp } from "@/features/media/date-groups";
import { MediaFilterChips, MediaFilters } from "@/features/media/media-filters";
import { MediaGrid, MediaGridSkeleton, MediaPaginationFooter } from "@/features/media/media-grid";
import { MediaTile } from "@/features/media/media-tile";
import { toChatMedia } from "@/features/media/media-utils";
import {
  DEFAULT_MEDIA_FILTERS,
  type MediaFavoriteFilter,
  type MediaFilterState,
  type MediaKindFilter,
  type MediaSort,
  type MediaViewMode,
} from "@/features/media/types";
import { useFavoriteMutation, useSharedMedia } from "@/features/media/use-shared-media";
import { useMediaRealtime } from "@/features/media/use-media-realtime";
import type { SharedMediaItemDto } from "@/lib/media/client-api";
import { cn } from "@/lib/utils";

type MediaLibraryProps = {
  conversationId: string;
  userId: string;
  userName: string;
  partnerId: string | null;
  partnerName: string;
};

type ViewerState = {
  items: SharedMediaItemDto[];
  index: number;
};

const MODES: readonly MediaViewMode[] = ["all", "partner", "you", "albums"];

function parseMode(value: string | null): MediaViewMode {
  return MODES.includes(value as MediaViewMode) ? (value as MediaViewMode) : "all";
}

function parseKind(value: string | null): MediaKindFilter {
  if (value === "image" || value === "video") return value;
  return "all";
}

export function MediaLibrary({
  conversationId,
  userId,
  userName,
  partnerId,
  partnerName,
}: MediaLibraryProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // URL is the single source of navigation state so Back behaves naturally.
  const mode = parseMode(searchParams.get("view"));
  const albumId = searchParams.get("album");
  const filters: MediaFilterState = useMemo(
    () => ({
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      favorites: (searchParams.get("hearts") as MediaFavoriteFilter) || "any",
      sort: (searchParams.get("sort") as MediaSort) || "newest",
      mediaType: parseKind(searchParams.get("type")),
    }),
    [searchParams],
  );

  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const [addToAlbumFor, setAddToAlbumFor] = useState<string | null>(null);

  useMediaRealtime(conversationId);
  const favorite = useFavoriteMutation(userId);

  const senderId = mode === "partner" ? partnerId : mode === "you" ? userId : null;

  const query = useSharedMedia({
    userId,
    filters: { ...filters, senderId },
    enabled: mode !== "albums",
  });

  // "Loved by both" is derived from the two favorite records, never stored.
  const lovedByBoth = useMemo(
    () => query.items.filter((item) => item.favoritedBy.length >= 2).slice(0, 12),
    [query.items],
  );

  /**
   * Tab and filter changes replace the entry so Back leaves Media instead of
   * unwinding every toggle. Opening an album pushes, so Back closes the album.
   *
   * Native history keeps useSearchParams in sync without re-running the server
   * component, so switching modes is instant instead of waiting on a round trip.
   */
  const setParams = useCallback(
    (patch: Record<string, string | null>, history: "replace" | "push" = "replace") => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      const href = qs ? `/media?${qs}` : "/media";
      if (history === "push") window.history.pushState(null, "", href);
      else window.history.replaceState(null, "", href);
    },
    [searchParams],
  );

  const subjectFor = useCallback(
    (item: SharedMediaItemDto) =>
      `${item.mediaType === "video" ? "video" : "photo"} from ${item.senderId === userId ? userName : partnerName}`,
    [partnerName, userId, userName],
  );

  const labelFor = useCallback(
    (item: SharedMediaItemDto) => `Open ${subjectFor(item)}`,
    [subjectFor],
  );

  const openViewer = useCallback((items: SharedMediaItemDto[], index: number) => {
    setViewer({ items, index });
  }, []);

  const toggleFavorite = useCallback(
    (item: SharedMediaItemDto) => {
      favorite.mutate({ mediaId: item.id, favorite: !item.favoritedBy.includes(userId) });
    },
    [favorite, userId],
  );

  const modeLabels: Record<MediaViewMode, string> = {
    all: "All",
    partner: partnerName,
    you: userName,
    albums: "Albums",
  };

  const emptyCopy: Record<Exclude<MediaViewMode, "albums">, { title: string; body: string }> = {
    all: {
      title: "Nothing shared yet",
      body: "Photos, videos, and little moments will gather here.",
    },
    partner: {
      title: `Nothing from ${partnerName} yet`,
      body: "They'll show up here the moment one arrives.",
    },
    you: {
      title: "You haven't shared anything yet",
      body: "Send a photo or video from chat and it'll live here too.",
    },
  };

  // Viewer state lives against the item list it was opened from, so navigating
  // inside the viewer always matches what's on screen behind it.
  const viewerItem = viewer ? viewer.items[viewer.index] : null;
  const viewerMedia = useMemo(() => (viewer ? viewer.items.map(toChatMedia) : []), [viewer]);

  const filtersActive =
    filters.from !== null ||
    filters.to !== null ||
    filters.favorites !== "any" ||
    filters.sort !== "newest";

  return (
    <div className="w-full" data-testid="media-library" data-view={mode}>
      {albumId ? (
        <AlbumDetail
          albumId={albumId}
          userId={userId}
          userName={userName}
          partnerName={partnerName}
          partnerId={partnerId}
          // Explicit rather than router.back() so a deep link or a delete
          // still lands on the albums list instead of leaving the app.
          onBack={() => setParams({ album: null, view: "albums" })}
          onOpenPhoto={openViewer}
          onToggleFavorite={toggleFavorite}
        />
      ) : (
        <>
          <nav
            className="flex [scrollbar-width:none] gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden"
            aria-label="Media views"
          >
            {MODES.filter((value) => value !== "partner" || partnerId).map((value) => {
              const active = mode === value;
              return (
                <button
                  key={value}
                  type="button"
                  data-testid={`media-mode-${value}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "shhh-nav-bubble shhh-press rounded-pill min-h-10 shrink-0 px-4 text-sm font-semibold",
                    active
                      ? "bg-accent text-on-accent shadow-[var(--shhh-shadow-soft)]"
                      : "bg-bg-soft text-secondary-text hover:text-primary-text",
                    "focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)] focus-visible:ring-offset-2 focus-visible:outline-none",
                  )}
                  onClick={() => setParams({ view: value === "all" ? null : value, album: null })}
                >
                  {modeLabels[value]}
                </button>
              );
            })}
          </nav>

          {mode !== "albums" ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {(
                [
                  ["all", "All media"],
                  ["image", "Photos"],
                  ["video", "Videos"],
                ] as const
              ).map(([value, label]) => {
                const active = filters.mediaType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    data-testid={`media-type-${value}`}
                    aria-pressed={active}
                    className={cn(
                      "shhh-press rounded-pill min-h-10 shrink-0 px-3.5 text-sm font-medium",
                      active
                        ? "bg-accent-soft text-accent"
                        : "bg-bg-soft text-secondary-text hover:text-primary-text",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)]",
                    )}
                    onClick={() => setParams({ type: value === "all" ? null : value })}
                  >
                    {label}
                  </button>
                );
              })}
              <MediaFilters
                filters={filters}
                partnerName={partnerName}
                onApply={(next) =>
                  setParams({
                    from: next.from,
                    to: next.to,
                    hearts: next.favorites === "any" ? null : next.favorites,
                    sort: next.sort === "newest" ? null : next.sort,
                    type: next.mediaType === "all" ? null : next.mediaType,
                  })
                }
              />
              <MediaFilterChips
                filters={filters}
                partnerName={partnerName}
                onChange={(next) =>
                  setParams({
                    from: next.from,
                    to: next.to,
                    hearts: next.favorites === "any" ? null : next.favorites,
                    sort: next.sort === "newest" ? null : next.sort,
                    type: next.mediaType === "all" ? null : next.mediaType,
                  })
                }
              />
            </div>
          ) : null}

          <div key={mode} className="shhh-mode-panel mt-5">
            {mode === "albums" ? (
              <AlbumsHome
                userId={userId}
                userName={userName}
                partnerName={partnerName}
                partnerId={partnerId}
                onOpenAlbum={(id) => setParams({ album: id, view: "albums" }, "push")}
              />
            ) : query.isLoading ? (
              <MediaGridSkeleton />
            ) : query.isError ? (
              <div className="py-14 text-center" data-testid="media-error">
                <p className="text-secondary-text text-sm">Couldn&apos;t load media.</p>
                <button
                  type="button"
                  className="shhh-press rounded-pill bg-accent-soft text-accent mt-3 min-h-10 px-4 text-sm font-medium focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)] focus-visible:outline-none"
                  onClick={() => void query.refetch()}
                >
                  Retry
                </button>
              </div>
            ) : query.items.length === 0 ? (
              <div
                className="flex flex-col items-center px-6 py-16 text-center"
                data-testid="media-empty"
              >
                <h2 className="font-handmade text-primary-text text-2xl tracking-tight">
                  {filtersActive ? "Nothing here" : emptyCopy[mode].title}
                </h2>
                <p className="text-secondary-text mt-2 max-w-xs text-sm leading-relaxed">
                  {filtersActive
                    ? "Try widening the dates or clearing the filters."
                    : emptyCopy[mode].body}
                </p>
                {filtersActive ? (
                  <button
                    type="button"
                    data-testid="media-clear-filters"
                    className="shhh-press rounded-pill bg-accent-soft text-accent mt-5 min-h-10 px-4 text-sm font-medium focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)] focus-visible:outline-none"
                    onClick={() =>
                      setParams({ from: null, to: null, hearts: null, sort: null, type: null })
                    }
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="grid min-w-0 gap-7">
                {mode === "all" && !filtersActive && lovedByBoth.length > 0 ? (
                  // min-w-0: without it the row's content-based minimum wins over the
                  // track and the whole page gains a horizontal scrollbar on a phone.
                  <section
                    aria-labelledby="loved-by-both"
                    data-testid="loved-by-both"
                    className="min-w-0"
                  >
                    <h2
                      id="loved-by-both"
                      className="text-secondary-text mb-2.5 flex items-center gap-1.5 px-0.5 text-sm font-semibold"
                    >
                      <Heart
                        className="size-3.5"
                        aria-hidden
                        fill="currentColor"
                        style={{ color: "var(--shhh-love)" }}
                      />
                      Loved by both
                    </h2>
                    <ul className="flex [scrollbar-width:none] gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
                      {lovedByBoth.map((item) => (
                        <li key={item.id} className="w-24 shrink-0 sm:w-28">
                          <MediaTile
                            item={item}
                            label={labelFor(item)}
                            subject={subjectFor(item)}
                            favorited={item.favoritedBy.includes(userId)}
                            lovedByBoth
                            onOpen={() =>
                              openViewer(
                                lovedByBoth,
                                lovedByBoth.findIndex((entry) => entry.id === item.id),
                              )
                            }
                            onToggleFavorite={() => toggleFavorite(item)}
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                <MediaGrid
                  items={query.items}
                  userId={userId}
                  labelFor={labelFor}
                  subjectFor={subjectFor}
                  onOpen={(item) =>
                    openViewer(
                      query.items,
                      query.items.findIndex((entry) => entry.id === item.id),
                    )
                  }
                  onToggleFavorite={toggleFavorite}
                />

                <MediaPaginationFooter
                  hasNextPage={Boolean(query.hasNextPage)}
                  isFetchingNextPage={query.isFetchingNextPage}
                  onLoadMore={() => void query.fetchNextPage()}
                />
              </div>
            )}
          </div>
        </>
      )}

      <PhotoViewer
        key={viewerItem?.id ?? "closed"}
        open={Boolean(viewer)}
        media={viewerMedia}
        initialIndex={viewer?.index ?? 0}
        senderName={
          viewerItem ? (viewerItem.senderId === userId ? userName : partnerName) : undefined
        }
        caption={viewerItem?.caption}
        timestampLabel={viewerItem ? formatMediaTimestamp(viewerItem.createdAt) : undefined}
        favorite={
          viewerItem
            ? {
                favorited: viewerItem.favoritedBy.includes(userId),
                lovedByBoth: viewerItem.favoritedBy.length >= 2,
                onToggle: () => {
                  toggleFavorite(viewerItem);
                  // Keep the viewer's own copy in step with the optimistic cache.
                  setViewer((current) =>
                    current
                      ? {
                          ...current,
                          items: current.items.map((entry) =>
                            entry.id === viewerItem.id
                              ? {
                                  ...entry,
                                  favoritedBy: entry.favoritedBy.includes(userId)
                                    ? entry.favoritedBy.filter((id) => id !== userId)
                                    : [...entry.favoritedBy, userId],
                                }
                              : entry,
                          ),
                        }
                      : current,
                  );
                },
              }
            : undefined
        }
        onIndexChange={(index) =>
          setViewer((current) => (current ? { ...current, index } : current))
        }
        onJumpToMessage={
          viewerItem
            ? () => {
                setViewer(null);
                router.push(chatFocusHref(viewerItem.messageId, "media"));
              }
            : undefined
        }
        onAddToAlbum={
          viewerItem
            ? () => {
                setViewer(null);
                setAddToAlbumFor(viewerItem.id);
              }
            : undefined
        }
        onClose={() => {
          setViewer(null);
          // Pick up any hearts the partner added while the viewer was open.
          void queryClient.invalidateQueries({ queryKey: ["media", "shared"] });
        }}
      />

      <AddToAlbumSheet
        open={Boolean(addToAlbumFor)}
        mediaId={addToAlbumFor}
        onClose={() => setAddToAlbumFor(null)}
        userId={userId}
        userName={userName}
        partnerName={partnerName}
        partnerId={partnerId}
      />
    </div>
  );
}

export { DEFAULT_MEDIA_FILTERS };
