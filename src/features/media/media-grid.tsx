"use client";

import { useEffect, useRef } from "react";

import { groupByDate } from "@/features/media/date-groups";
import { MediaTile, MediaTileSkeleton } from "@/features/media/media-tile";
import type { SharedMediaItemDto } from "@/lib/media/client-api";
import { cn } from "@/lib/utils";

const GRID_CLASS =
  "grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-2.5 lg:grid-cols-5 lg:gap-3";

export type MediaGridProps = {
  items: SharedMediaItemDto[];
  userId: string;
  onOpen: (item: SharedMediaItemDto) => void;
  onToggleFavorite?: (item: SharedMediaItemDto) => void;
  labelFor: (item: SharedMediaItemDto) => string;
  subjectFor?: (item: SharedMediaItemDto) => string;
  /** Selection mode swaps the heart for a checkmark and suppresses the viewer. */
  selectable?: boolean;
  selectedIds?: Set<string>;
  grouped?: boolean;
  testId?: string;
};

export function MediaGrid({
  items,
  userId,
  onOpen,
  onToggleFavorite,
  labelFor,
  subjectFor,
  selectable = false,
  selectedIds,
  grouped = true,
  testId = "media-grid",
}: MediaGridProps) {
  if (!grouped) {
    return (
      <ul className={GRID_CLASS} data-testid={testId}>
        {items.map((item, index) => (
          <li key={item.id}>
            <MediaTile
              item={item}
              label={labelFor(item)}
              subject={subjectFor?.(item)}
              priority={index < 6}
              selectable={selectable}
              selected={selectedIds?.has(item.id)}
              favorited={item.favoritedBy.includes(userId)}
              lovedByBoth={item.favoritedBy.length >= 2}
              onOpen={() => onOpen(item)}
              onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(item) : undefined}
            />
          </li>
        ))}
      </ul>
    );
  }

  const groups = groupByDate(items);

  return (
    <div className="grid gap-6" data-testid={testId}>
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`media-group-${group.key}`}>
          <h2
            id={`media-group-${group.key}`}
            className="mb-2.5 px-0.5 text-sm font-semibold text-secondary-text"
          >
            {group.label}
          </h2>
          <ul className={GRID_CLASS}>
            {group.items.map((item, index) => (
              <li key={item.id}>
                <MediaTile
                  item={item}
                  label={labelFor(item)}
                  subject={subjectFor?.(item)}
                  priority={index < 6 && group === groups[0]}
                  selectable={selectable}
                  selected={selectedIds?.has(item.id)}
                  favorited={item.favoritedBy.includes(userId)}
                  lovedByBoth={item.favoritedBy.length >= 2}
                  onOpen={() => onOpen(item)}
                  onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(item) : undefined}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function MediaGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid gap-6" data-testid="media-skeleton" aria-hidden>
      <div>
        <div className="mb-2.5 h-4 w-20 animate-shhh-breathe rounded-pill bg-bg-soft motion-reduce:animate-none" />
        <ul className={GRID_CLASS}>
          {Array.from({ length: count }, (_, index) => (
            <li key={index}>
              <MediaTileSkeleton delayMs={index * 45} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Loads the next page as the sentinel scrolls into view, with an explicit
 * button underneath so keyboard and reduced-motion users are never stranded.
 */
export function MediaPaginationFooter({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const loadMore = useRef(onLoadMore);

  useEffect(() => {
    loadMore.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    if (!hasNextPage) return;
    const node = sentinel.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore.current();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage]);

  if (!hasNextPage) return null;

  return (
    <div ref={sentinel} className="mt-6 flex justify-center">
      <button
        type="button"
        data-testid="media-load-more"
        disabled={isFetchingNextPage}
        className={cn(
          "shhh-press min-h-11 rounded-pill bg-surface-elevated px-5 text-sm font-medium text-secondary-text",
          "shadow-[var(--shhh-shadow-soft)] hover:text-primary-text",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)]",
          "disabled:opacity-60",
        )}
        onClick={onLoadMore}
      >
        {isFetchingNextPage ? "Loading…" : "Show earlier"}
      </button>
    </div>
  );
}
