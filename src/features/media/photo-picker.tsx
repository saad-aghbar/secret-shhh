"use client";

import { useMemo, useState } from "react";

import { MediaGrid, MediaGridSkeleton, MediaPaginationFooter } from "@/features/media/media-grid";
import { useSharedMedia } from "@/features/media/use-shared-media";
import { DEFAULT_MEDIA_FILTERS } from "@/features/media/types";
import { cn } from "@/lib/utils";

const pill =
  "shhh-press min-h-9 rounded-pill px-3 text-xs font-medium transition-[background-color,color] duration-[var(--shhh-motion-normal)]";

export type PhotoPickerProps = {
  userId: string;
  userName: string;
  partnerName: string;
  partnerId: string | null;
  selected: string[];
  onSelectedChange: (next: string[]) => void;
  /** Items already in the album — shown as unavailable rather than hidden. */
  excludeIds?: Set<string>;
};

/**
 * Multi-select over media that has already been shared. Album flows never
 * upload; they curate what the two of you already sent each other.
 */
export function PhotoPicker({
  userId,
  userName,
  partnerName,
  partnerId,
  selected,
  onSelectedChange,
  excludeIds,
}: PhotoPickerProps) {
  const [senderId, setSenderId] = useState<string | null>(null);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const query = useSharedMedia({
    userId,
    filters: { ...DEFAULT_MEDIA_FILTERS, senderId },
    pageSize: 60,
  });

  const items = useMemo(
    () => (excludeIds ? query.items.filter((item) => !excludeIds.has(item.id)) : query.items),
    [query.items, excludeIds],
  );

  function toggle(id: string) {
    onSelectedChange(
      selectedSet.has(id) ? selected.filter((entry) => entry !== id) : [...selected, id],
    );
  }

  const senderTabs: readonly (readonly [string | null, string])[] = partnerId
    ? ([
        [null, "All"],
        [partnerId, partnerName],
        [userId, userName],
      ] as const)
    : ([
        [null, "All"],
        [userId, userName],
      ] as const);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by sender">
        {senderTabs.map(([value, label]) => {
          const active = senderId === value;
          return (
            <button
              key={label}
              type="button"
              aria-pressed={active}
              data-testid={`picker-sender-${label}`}
              className={cn(
                pill,
                active ? "bg-accent-soft text-accent" : "bg-bg-soft text-secondary-text",
              )}
              onClick={() => setSenderId(value)}
            >
              {label}
            </button>
          );
        })}
      </div>

      {query.isLoading ? (
        <MediaGridSkeleton count={9} />
      ) : query.isError ? (
        <div className="py-8 text-center">
          <p className="text-sm text-secondary-text">Couldn&apos;t load media.</p>
          <button
            type="button"
            className="shhh-press mt-2 min-h-9 rounded-pill bg-accent-soft px-4 text-sm font-medium text-accent"
            onClick={() => void query.refetch()}
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-secondary-text">
          Nothing to add yet.
        </p>
      ) : (
        <>
          <MediaGrid
            testId="photo-picker-grid"
            items={items}
            userId={userId}
            grouped={false}
            selectable
            selectedIds={selectedSet}
            labelFor={(item) =>
              `${selectedSet.has(item.id) ? "Deselect" : "Select"} ${
                item.mediaType === "video" ? "video" : "photo"
              } from ${item.senderId === userId ? userName : partnerName}`
            }
            onOpen={(item) => toggle(item.id)}
          />
          <MediaPaginationFooter
            hasNextPage={Boolean(query.hasNextPage)}
            isFetchingNextPage={query.isFetchingNextPage}
            onLoadMore={() => void query.fetchNextPage()}
          />
        </>
      )}
    </div>
  );
}
