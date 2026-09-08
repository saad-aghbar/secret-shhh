"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { HistoryCalendar } from "@/features/history/history-calendar";
import { SearchFilterChips, SearchFilters } from "@/features/search/search-filters";
import { SearchInput } from "@/features/search/search-input";
import { SearchResults } from "@/features/search/search-results";
import type {
  SearchFiltersState,
  SearchSenderFilter,
  SearchTab,
  SearchTypeFilter,
} from "@/features/search/search-types";
import { useMessageSearch } from "@/features/search/use-message-search";
import { cn } from "@/lib/utils";

const SEARCH_SCROLL_KEY = "shhh.search.scroll";

type SearchExperienceProps = {
  userId: string;
  partnerName: string;
};

/**
 * URL state (q, sender, from, to, type, tab, hy, hm) for Back restore.
 * Private 2-person app — no analytics; query may appear in browser history.
 */
export function SearchExperience({ userId, partnerName }: SearchExperienceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scrollerRef = useRef<HTMLDivElement>(null);

  const tab = (searchParams.get("tab") === "history" ? "history" : "search") as SearchTab;
  const q = searchParams.get("q") ?? "";
  const unavailable = searchParams.get("unavailable") === "1";
  const filters: SearchFiltersState = useMemo(
    () => ({
      sender: (searchParams.get("sender") as SearchSenderFilter) || "anyone",
      from: searchParams.get("from") ?? "",
      to: searchParams.get("to") ?? "",
      type: (searchParams.get("type") as SearchTypeFilter) || "all",
    }),
    [searchParams],
  );

  const historyYear = Number(searchParams.get("hy")) || undefined;
  const historyMonth = Number(searchParams.get("hm")) || undefined;

  const replaceParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (
          value === null ||
          value === "" ||
          (key === "sender" && value === "anyone") ||
          (key === "type" && value === "all") ||
          (key === "tab" && value === "search") ||
          (key === "unavailable" && value !== "1")
        ) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const applyFilters = useCallback(
    (next: SearchFiltersState) => {
      replaceParams({
        sender: next.sender,
        from: next.from,
        to: next.to,
        type: next.type,
      });
    },
    [replaceParams],
  );

  const search = useMessageSearch({
    q,
    filters,
    enabled: tab === "search",
  });

  const emptyQuery =
    !q.trim() &&
    filters.sender === "anyone" &&
    !filters.from &&
    !filters.to &&
    filters.type === "all";

  // Restore results scroll after Back from chat.
  useEffect(() => {
    if (tab !== "search") return;
    try {
      const raw = sessionStorage.getItem(SEARCH_SCROLL_KEY);
      if (!raw) return;
      const y = Number(raw);
      if (!Number.isFinite(y)) return;
      window.requestAnimationFrame(() => window.scrollTo(0, y));
    } catch {
      /* ignore */
    }
  }, [tab]);

  useEffect(() => {
    if (tab !== "search") return;
    const onScroll = () => {
      try {
        sessionStorage.setItem(SEARCH_SCROLL_KEY, String(window.scrollY));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [tab]);

  return (
    <div
      ref={scrollerRef}
      className={cn(
        "mx-auto flex w-full max-w-lg flex-1 flex-col",
        "gap-3 px-4 pb-[calc(5.5rem+var(--shhh-safe-bottom))] pt-3",
        "sm:gap-4 sm:px-5 sm:pt-4 sm:max-w-xl",
        "md:gap-5 md:px-6",
      )}
    >
      <div
        className="relative grid grid-cols-2 gap-1 rounded-[1.5rem] bg-bg-soft p-1"
        role="tablist"
        aria-label="Search sections"
      >
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-[1.25rem]",
            "bg-surface-elevated shadow-[var(--shhh-shadow-soft)]",
            "transition-transform duration-[var(--shhh-motion-normal)] ease-[var(--shhh-ease-settle)]",
            tab === "history" ? "translate-x-[calc(100%+0.25rem)]" : "translate-x-1",
          )}
        />
        {(
          [
            ["search", "Search"],
            ["history", "History"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            data-testid={`search-tab-${id}`}
            className={cn(
              "shhh-press relative z-[1] min-h-11 rounded-[1.25rem] text-sm font-medium",
              "transition-colors duration-[var(--shhh-motion-normal)] ease-[var(--shhh-ease-settle)]",
              tab === id ? "text-primary-text" : "text-secondary-text",
            )}
            onClick={() => replaceParams({ tab: id })}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        key={tab}
        className="shhh-tab-panel grid gap-3 sm:gap-4"
        data-testid={`search-panel-${tab}`}
      >
        {tab === "search" ? (
          <>
            {unavailable ? (
              <p
                className="animate-shhh-settle rounded-[1.25rem] bg-bg-soft px-4 py-3 text-center text-sm text-secondary-text"
                data-testid="message-unavailable"
                role="status"
              >
                This message isn&apos;t available anymore.
              </p>
            ) : null}
            {/* Phone: stacked search then Filters. md+: input + compact Filters trigger. */}
            <div className="flex flex-col gap-2.5 md:flex-row md:items-start md:gap-3">
              <div className="min-w-0 flex-1">
                <SearchInput value={q} onChange={(value) => replaceParams({ q: value })} />
              </div>
              <SearchFilters
                filters={filters}
                partnerName={partnerName}
                onApply={applyFilters}
                onOpenChange={(open) => {
                  if (open) {
                    replaceParams({ unavailable: null });
                  }
                }}
              />
            </div>
            <SearchFilterChips
              filters={filters}
              partnerName={partnerName}
              onChange={applyFilters}
            />
            <SearchResults
              results={search.results}
              loading={search.loading}
              loadingMore={search.loadingMore}
              error={search.error}
              offline={search.offline}
              emptyQuery={emptyQuery}
              voiceWordSearch={filters.type === "voice" && q.trim().length > 0}
              nextCursor={search.nextCursor}
              viewerId={userId}
              partnerName={partnerName}
              onLoadMore={() => void search.loadMore()}
              onRetry={() => search.retry()}
            />
          </>
        ) : (
          <HistoryCalendar
            year={historyYear}
            month={historyMonth}
            viewerId={userId}
            partnerName={partnerName}
            onMonthChange={(y, m) =>
              replaceParams({
                tab: "history",
                hy: String(y),
                hm: String(m),
              })
            }
          />
        )}
      </div>
    </div>
  );
}
