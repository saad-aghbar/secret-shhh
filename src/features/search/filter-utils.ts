import type { SearchFiltersState } from "@/features/search/search-types";

export const DEFAULT_SEARCH_FILTERS: SearchFiltersState = {
  sender: "anyone",
  from: "",
  to: "",
  type: "all",
};

/** Active categories: sender ≠ anyone, type ≠ all, date range set. */
export function countActiveFilters(filters: SearchFiltersState): number {
  let n = 0;
  if (filters.sender !== "anyone") n += 1;
  if (filters.type !== "all") n += 1;
  if (filters.from || filters.to) n += 1;
  return n;
}

export function filtersEqual(a: SearchFiltersState, b: SearchFiltersState): boolean {
  return a.sender === b.sender && a.type === b.type && a.from === b.from && a.to === b.to;
}

export function isDefaultFilters(filters: SearchFiltersState): boolean {
  return filtersEqual(filters, DEFAULT_SEARCH_FILTERS);
}
