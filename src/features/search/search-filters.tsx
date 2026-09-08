"use client";

import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { SlidersHorizontal, X } from "lucide-react";

import { formatShortRangeLabel } from "@/components/shhh/day-grid";
import { ShhhButton, ShhhSheet } from "@/components/shhh";
import { DateRangeCalendar } from "@/features/search/date-range-calendar";
import { countActiveFilters, DEFAULT_SEARCH_FILTERS } from "@/features/search/filter-utils";
import type { SearchFiltersState } from "@/features/search/search-types";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/utils";

type SearchFiltersProps = {
  filters: SearchFiltersState;
  partnerName: string;
  onApply: (next: SearchFiltersState) => void;
  onOpenChange?: (open: boolean) => void;
};

const pill =
  "shhh-press min-h-11 rounded-pill px-3.5 text-sm font-medium transition-[background-color,color,transform] duration-[var(--shhh-motion-normal)] ease-[var(--shhh-ease-settle)]";

function FilterBody({
  draft,
  partnerName,
  onDraftChange,
}: {
  draft: SearchFiltersState;
  partnerName: string;
  onDraftChange: (next: SearchFiltersState) => void;
}) {
  return (
    <div className="grid gap-4 md:gap-5">
      <fieldset>
        <legend className="text-secondary-text mb-2 text-xs font-medium">From</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["anyone", "Anyone"],
              ["me", "Me"],
              ["partner", partnerName],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={cn(
                pill,
                draft.sender === value
                  ? "bg-accent-soft text-accent"
                  : "bg-bg-soft text-secondary-text",
              )}
              aria-pressed={draft.sender === value}
              onClick={() => onDraftChange({ ...draft, sender: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-secondary-text mb-2 text-xs font-medium">Type</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "All"],
              ["text", "Text"],
              ["links", "Links"],
              ["photos", "Photos"],
              ["videos", "Videos"],
              ["voice", "Voice"],
              ["stickers", "Stickers"],
              ["doodles", "Doodles"],
              ["calls", "Calls"],
              ["music", "Music"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={cn(
                pill,
                draft.type === value
                  ? "bg-accent-soft text-accent"
                  : "bg-bg-soft text-secondary-text",
              )}
              aria-pressed={draft.type === value}
              onClick={() => onDraftChange({ ...draft, type: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <DateRangeCalendar
        from={draft.from}
        to={draft.to}
        onChange={(next) => onDraftChange({ ...draft, ...next })}
      />
    </div>
  );
}

/**
 * Mobile-first Filters popup: ShhhSheet on phone, compact floating panel on md+.
 * Never always-on. Draft until Apply.
 */
export function SearchFilters({ filters, partnerName, onApply, onOpenChange }: SearchFiltersProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const activeCount = countActiveFilters(filters);

  useLayoutEffect(() => {
    if (!open || !isDesktop) return;

    function place() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const gap = 8;
      const width = Math.min(22 * 16, window.innerWidth - 32);
      const right = Math.max(16, window.innerWidth - rect.right);
      const top = Math.min(rect.bottom + gap, window.innerHeight - 48);
      const maxHeight = Math.max(240, window.innerHeight - top - 16);
      setPanelStyle({
        top,
        right,
        width,
        maxHeight,
      });
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        onOpenChange?.(false);
      }
    }

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, isDesktop, onOpenChange]);

  function setOpenSafe(next: boolean) {
    if (next) {
      setDraft(filters);
      const input = document.getElementById("shhh-search-q") as HTMLInputElement | null;
      input?.blur();
    }
    setOpen(next);
    onOpenChange?.(next);
  }

  function applyAndClose() {
    onApply(draft);
    setOpenSafe(false);
  }

  function clearDraft() {
    setDraft({ ...DEFAULT_SEARCH_FILTERS });
  }

  const footer = (
    <div className="flex gap-2">
      <ShhhButton
        type="button"
        variant="ghost"
        className="flex-1"
        data-testid="filters-clear"
        onClick={clearDraft}
      >
        Clear
      </ShhhButton>
      <ShhhButton
        type="button"
        variant="primary"
        className="flex-[1.4]"
        data-testid="filters-apply"
        onClick={applyAndClose}
      >
        Apply filters
      </ShhhButton>
    </div>
  );

  const triggerLabel = activeCount > 0 ? `Filters · ${activeCount}` : "Filters";

  const desktopPanel =
    typeof document !== "undefined" && isDesktop && open
      ? createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-[60] cursor-default bg-[color-mix(in_srgb,var(--shhh-overlay)_35%,transparent)]"
              aria-label="Close filters"
              data-testid="filters-panel-backdrop"
              onClick={() => setOpenSafe(false)}
            />
            <div
              id={panelId}
              data-testid="filters-desktop-panel"
              role="dialog"
              aria-label="Filters"
              style={panelStyle}
              className={cn(
                "fixed z-[61] flex flex-col overflow-hidden",
                "animate-shhh-settle bg-surface-elevated rounded-[1.5rem] p-4 md:p-5",
                "shadow-[var(--shhh-shadow-float)]",
              )}
            >
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pe-0.5">
                <FilterBody draft={draft} partnerName={partnerName} onDraftChange={setDraft} />
              </div>
              <div className="border-divider/40 mt-4 shrink-0 border-t pt-3">{footer}</div>
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <div ref={triggerRef} className="relative w-full md:w-auto">
      <ShhhButton
        type="button"
        variant="secondary"
        className="min-h-12 w-full gap-2 md:min-h-11 md:w-auto"
        onClick={() => setOpenSafe(!open)}
        data-testid="search-filters-open"
        aria-expanded={open}
        aria-controls={panelId}
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        {triggerLabel}
      </ShhhButton>

      {isDesktop ? (
        desktopPanel
      ) : (
        <ShhhSheet open={open} onClose={() => setOpenSafe(false)} title="Filters" footer={footer}>
          <div id={panelId}>
            <FilterBody draft={draft} partnerName={partnerName} onDraftChange={setDraft} />
          </div>
        </ShhhSheet>
      )}
    </div>
  );
}

type FilterChipsProps = {
  filters: SearchFiltersState;
  partnerName: string;
  onChange: (next: SearchFiltersState) => void;
};

export function SearchFilterChips({ filters, partnerName, onChange }: FilterChipsProps) {
  const chips: { key: string; label: string; clear: () => SearchFiltersState }[] = [];
  if (filters.sender === "me") {
    chips.push({
      key: "sender",
      label: "Me",
      clear: () => ({ ...filters, sender: "anyone" }),
    });
  } else if (filters.sender === "partner") {
    chips.push({
      key: "sender",
      label: partnerName,
      clear: () => ({ ...filters, sender: "anyone" }),
    });
  }
  if (filters.type === "text") {
    chips.push({
      key: "type",
      label: "Text",
      clear: () => ({ ...filters, type: "all" }),
    });
  } else if (filters.type === "links") {
    chips.push({
      key: "type",
      label: "Links",
      clear: () => ({ ...filters, type: "all" }),
    });
  } else if (filters.type === "photos") {
    chips.push({
      key: "type",
      label: "Photos",
      clear: () => ({ ...filters, type: "all" }),
    });
  } else if (filters.type === "videos") {
    chips.push({
      key: "type",
      label: "Videos",
      clear: () => ({ ...filters, type: "all" }),
    });
  } else if (filters.type === "voice") {
    chips.push({
      key: "type",
      label: "Voice",
      clear: () => ({ ...filters, type: "all" }),
    });
  } else if (filters.type === "stickers") {
    chips.push({
      key: "type",
      label: "Stickers",
      clear: () => ({ ...filters, type: "all" }),
    });
  } else if (filters.type === "doodles") {
    chips.push({
      key: "type",
      label: "Doodles",
      clear: () => ({ ...filters, type: "all" }),
    });
  } else if (filters.type === "calls") {
    chips.push({
      key: "type",
      label: "Calls",
      clear: () => ({ ...filters, type: "all" }),
    });
  } else if (filters.type === "music") {
    chips.push({
      key: "type",
      label: "Music",
      clear: () => ({ ...filters, type: "all" }),
    });
  }
  if (filters.from || filters.to) {
    chips.push({
      key: "dates",
      label: formatShortRangeLabel(filters.from, filters.to),
      clear: () => ({ ...filters, from: "", to: "" }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2" data-testid="filter-chips">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className={cn(
            "shhh-press rounded-pill bg-accent-soft/70 inline-flex min-h-9 items-center gap-1.5 px-3",
            "text-accent text-xs font-medium",
          )}
          data-testid={`filter-chip-${chip.key}`}
          onClick={() => onChange(chip.clear())}
        >
          {chip.label}
          <X className="size-3.5" aria-hidden />
          <span className="sr-only">Remove {chip.label}</span>
        </button>
      ))}
    </div>
  );
}
