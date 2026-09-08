/** Shared vocabulary for the media library UI, URL state, and cache keys. */

export type MediaViewMode = "all" | "partner" | "you" | "albums";

export type MediaFavoriteFilter = "any" | "mine" | "both";
export type MediaSort = "newest" | "oldest";

export type MediaKindFilter = "all" | "image" | "video";

export type MediaFilterState = {
  from: string | null;
  to: string | null;
  favorites: MediaFavoriteFilter;
  sort: MediaSort;
  mediaType: MediaKindFilter;
};

export const DEFAULT_MEDIA_FILTERS: MediaFilterState = {
  from: null,
  to: null,
  favorites: "any",
  sort: "newest",
  mediaType: "all",
};

export function isDefaultFilters(filters: MediaFilterState) {
  return (
    filters.from === null &&
    filters.to === null &&
    filters.favorites === "any" &&
    filters.sort === "newest" &&
    filters.mediaType === "all"
  );
}

export function activeFilterCount(filters: MediaFilterState) {
  let count = 0;
  if (filters.from || filters.to) count += 1;
  if (filters.favorites !== "any") count += 1;
  if (filters.sort !== "newest") count += 1;
  return count;
}

/** Serializable slice of state that identifies a shared-media query. */
export type MediaQueryFilters = MediaFilterState & {
  senderId: string | null;
};
