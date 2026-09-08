"use client";

import { ShhhButton, ShhhEmptyState, ShhhSpinner } from "@/components/shhh";
import { SearchResultRow } from "@/features/search/search-result-item";
import type { SearchResultItem } from "@/lib/search/client-api";

type SearchResultsProps = {
  results: SearchResultItem[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  offline: boolean;
  emptyQuery: boolean;
  /** Words were typed while the Voice filter is on — voice has no transcript to match. */
  voiceWordSearch?: boolean;
  nextCursor: string | null;
  viewerId: string;
  partnerName: string;
  onLoadMore: () => void;
  onRetry: () => void;
};

export function SearchResults({
  results,
  loading,
  loadingMore,
  error,
  offline,
  emptyQuery,
  voiceWordSearch = false,
  nextCursor,
  viewerId,
  partnerName,
  onLoadMore,
  onRetry,
}: SearchResultsProps) {
  if (offline) {
    return (
      <ShhhEmptyState
        title="Search needs a connection."
        description="Full conversation search works online. Your chat still works offline."
      />
    );
  }

  if (error) {
    return (
      <div className="grid gap-3 py-8 text-center">
        <p className="text-sm text-secondary-text">{error}</p>
        <ShhhButton type="button" variant="secondary" onClick={onRetry} className="mx-auto">
          Try again
        </ShhhButton>
      </div>
    );
  }

  if (emptyQuery && results.length === 0 && !loading) {
    return (
      <ShhhEmptyState
        title="Search your conversation."
        description="Try a word, a name, or something you both remember."
      />
    );
  }

  if (loading && results.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <ShhhSpinner label="Searching" />
      </div>
    );
  }

  if (!loading && results.length === 0 && voiceWordSearch) {
    return (
      <ShhhEmptyState
        title="Voice messages aren't searched by words."
        description="Clear the search to browse every voice message you've sent each other."
      />
    );
  }

  if (!loading && results.length === 0) {
    return (
      <ShhhEmptyState title="Nothing found here." description="Try different words or clear filters." />
    );
  }

  return (
    <div className="shhh-results-settle grid gap-2 md:gap-2.5" data-testid="search-results">
      {loading ? (
        <div className="flex justify-center py-2 opacity-70">
          <ShhhSpinner className="size-5" label="Updating results" />
        </div>
      ) : null}
      {results.map((item) => (
        <SearchResultRow
          key={item.id}
          item={item}
          viewerId={viewerId}
          partnerName={partnerName}
        />
      ))}
      {nextCursor ? (
        <ShhhButton
          type="button"
          variant="ghost"
          className="mx-auto"
          disabled={loadingMore}
          onClick={onLoadMore}
        >
          {loadingMore ? "Loading…" : "More results"}
        </ShhhButton>
      ) : null}
    </div>
  );
}
