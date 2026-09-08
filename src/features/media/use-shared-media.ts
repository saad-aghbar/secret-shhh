"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { mediaKeys } from "@/features/media/query-keys";
import { dedupeById } from "@/features/media/media-utils";
import type { MediaQueryFilters } from "@/features/media/types";
import {
  apiListSharedMedia,
  apiSetMediaFavorite,
  type SharedMediaItemDto,
} from "@/lib/media/client-api";
import { isRealtimeConfigured } from "@/lib/realtime/supabase";

type SharedMediaPageDto = { items: SharedMediaItemDto[]; nextCursor: string | null };

/**
 * Cursor-paginated shared media. Polling is the reconciliation path when
 * Supabase Realtime is not configured; with Realtime it only backstops
 * missed broadcasts.
 */
export function useSharedMedia(params: {
  userId: string;
  filters: MediaQueryFilters;
  enabled?: boolean;
  pageSize?: number;
}) {
  const { userId, filters, enabled = true, pageSize } = params;

  const query = useInfiniteQuery({
    queryKey: mediaKeys.shared(userId, filters),
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      apiListSharedMedia({
        cursor: pageParam,
        limit: pageSize,
        senderId: filters.senderId,
        from: filters.from,
        to: filters.to,
        favorites: filters.favorites,
        sort: filters.sort,
        mediaType: filters.mediaType,
      }),
    getNextPageParam: (last: SharedMediaPageDto) => last.nextCursor ?? undefined,
    refetchInterval: isRealtimeConfigured() ? 20_000 : 6_000,
    refetchOnWindowFocus: true,
    staleTime: 3_000,
  });

  const items = useMemo(
    () => dedupeById(query.data?.pages.flatMap((page) => page.items) ?? []),
    [query.data],
  );

  return { ...query, items };
}

/**
 * Optimistic heart across every cached media surface. On failure the previous
 * caches are restored, so a dropped request can never leave a lying heart.
 */
export function useFavoriteMutation(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ mediaId, favorite }: { mediaId: string; favorite: boolean }) =>
      apiSetMediaFavorite(mediaId, favorite),
    onMutate: async ({ mediaId, favorite }) => {
      await queryClient.cancelQueries({ queryKey: ["media"] });
      const snapshot = queryClient.getQueriesData({ queryKey: ["media"] });

      const applyFavorite = (item: SharedMediaItemDto): SharedMediaItemDto => {
        if (item.id !== mediaId) return item;
        const next = favorite
          ? [...new Set([...item.favoritedBy, userId])]
          : item.favoritedBy.filter((id) => id !== userId);
        return { ...item, favoritedBy: next };
      };

      queryClient.setQueriesData({ queryKey: ["media"] }, (data: unknown) => {
        if (!data || typeof data !== "object") return data;

        if ("pages" in data) {
          const paged = data as { pages: SharedMediaPageDto[]; pageParams: unknown[] };
          return {
            ...paged,
            pages: paged.pages.map((page) => ({
              ...page,
              items: page.items.map(applyFavorite),
            })),
          };
        }
        if ("album" in data) {
          const wrapped = data as { album: { items: SharedMediaItemDto[] } };
          return {
            ...wrapped,
            album: { ...wrapped.album, items: wrapped.album.items.map(applyFavorite) },
          };
        }
        return data;
      });

      return { snapshot };
    },
    onError: (_error, _variables, context) => {
      for (const [key, value] of context?.snapshot ?? []) {
        queryClient.setQueryData(key, value);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["media", "shared"] });
      void queryClient.invalidateQueries({ queryKey: ["media", "album"] });
    },
  });
}
