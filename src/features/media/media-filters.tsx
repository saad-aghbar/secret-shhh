"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useId, useState } from "react";

import { ShhhButton } from "@/components/shhh";
import { formatShortRangeLabel } from "@/components/shhh/day-grid";
import { DateRangeCalendar } from "@/features/search/date-range-calendar";
import { MediaOverlay } from "@/features/media/media-overlay";
import {
  activeFilterCount,
  DEFAULT_MEDIA_FILTERS,
  type MediaFilterState,
} from "@/features/media/types";
import { cn } from "@/lib/utils";

const pill =
  "shhh-press min-h-11 rounded-pill px-3.5 text-sm font-medium transition-[background-color,color,transform] duration-[var(--shhh-motion-normal)] ease-[var(--shhh-ease-settle)]";

function OptionRow<T extends string>({
  legend,
  value,
  options,
  onChange,
}: {
  legend: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (next: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-medium text-secondary-text">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(([option, label]) => {
          const selected = value === option;
          return (
            <button
              key={option}
              type="button"
              data-testid={`media-filter-${option}`}
              aria-pressed={selected}
              className={cn(
                pill,
                selected ? "bg-accent-soft text-accent" : "bg-bg-soft text-secondary-text",
              )}
              onClick={() => onChange(option)}
            >
              {/* Checkmark keeps the selected state readable without relying on color. */}
              {selected ? <span aria-hidden>✓ </span> : null}
              {label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Secondary filtering for the media library. Reuses the Phase 3 calendar and
 * its draft-until-Apply contract so both surfaces behave identically.
 */
export function MediaFilters({
  filters,
  partnerName,
  onApply,
}: {
  filters: MediaFilterState;
  partnerName: string;
  onApply: (next: MediaFilterState) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const panelId = useId();
  const count = activeFilterCount(filters);

  function openWith(next: boolean) {
    if (next) setDraft(filters);
    setOpen(next);
  }

  const footer = (
    <div className="flex gap-2">
      <ShhhButton
        variant="ghost"
        className="flex-1"
        data-testid="media-filters-clear"
        onClick={() => setDraft({ ...DEFAULT_MEDIA_FILTERS })}
      >
        Clear
      </ShhhButton>
      <ShhhButton
        variant="primary"
        className="flex-[1.4]"
        data-testid="media-filters-apply"
        onClick={() => {
          onApply(draft);
          setOpen(false);
        }}
      >
        Apply
      </ShhhButton>
    </div>
  );

  return (
    <>
      <button
        type="button"
        data-testid="media-filters-open"
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "shhh-press inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-pill px-3.5",
          "text-sm font-medium",
          count > 0
            ? "bg-accent-soft text-accent"
            : "bg-bg-soft text-secondary-text hover:text-primary-text",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)]",
        )}
        onClick={() => openWith(!open)}
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        {count > 0 ? `Filters · ${count}` : "Filters"}
      </button>

      <MediaOverlay open={open} onClose={() => openWith(false)} title="Filters" footer={footer}>
        <div id={panelId} className="grid gap-5">
          <OptionRow
            legend="Hearts"
            value={draft.favorites}
            options={[
              ["any", "All"],
              ["mine", "My favorites"],
              ["both", `Loved by you and ${partnerName}`],
            ]}
            onChange={(favorites) => setDraft({ ...draft, favorites })}
          />
          <OptionRow
            legend="Order"
            value={draft.sort}
            options={[
              ["newest", "Newest first"],
              ["oldest", "Oldest first"],
            ]}
            onChange={(sort) => setDraft({ ...draft, sort })}
          />
          <DateRangeCalendar
            from={draft.from ?? ""}
            to={draft.to ?? ""}
            onChange={(next) =>
              setDraft({ ...draft, from: next.from || null, to: next.to || null })
            }
          />
        </div>
      </MediaOverlay>
    </>
  );
}

/** Removable summary of what is currently narrowing the library. */
export function MediaFilterChips({
  filters,
  partnerName,
  onChange,
}: {
  filters: MediaFilterState;
  partnerName: string;
  onChange: (next: MediaFilterState) => void;
}) {
  const chips: { key: string; label: string; next: MediaFilterState }[] = [];

  if (filters.favorites === "mine") {
    chips.push({ key: "favorites", label: "My favorites", next: { ...filters, favorites: "any" } });
  } else if (filters.favorites === "both") {
    chips.push({
      key: "favorites",
      label: `Loved by you and ${partnerName}`,
      next: { ...filters, favorites: "any" },
    });
  }
  if (filters.sort === "oldest") {
    chips.push({ key: "sort", label: "Oldest first", next: { ...filters, sort: "newest" } });
  }
  if (filters.from || filters.to) {
    chips.push({
      key: "dates",
      label: formatShortRangeLabel(filters.from ?? "", filters.to ?? ""),
      next: { ...filters, from: null, to: null },
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2" data-testid="media-filter-chips">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          data-testid={`media-filter-chip-${chip.key}`}
          className="shhh-press inline-flex min-h-9 items-center gap-1.5 rounded-pill bg-accent-soft/70 px-3 text-xs font-medium text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)]"
          onClick={() => onChange(chip.next)}
        >
          {chip.label}
          <X className="size-3.5" aria-hidden />
          <span className="sr-only">Remove {chip.label}</span>
        </button>
      ))}
    </div>
  );
}
