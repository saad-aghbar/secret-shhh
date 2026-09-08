"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import {
  daysInMonth,
  dateRangeFromPreset,
  formatShortRangeLabel,
  normalizeDateRange,
  parseIsoDate,
  startWeekday,
  toIsoDate,
  WEEKDAY_LABELS,
  type DateRangePreset,
} from "@/components/shhh/day-grid";
import { ShhhButton, ShhhIconButton } from "@/components/shhh";
import { cn } from "@/lib/utils";

type DateRangeCalendarProps = {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
};

/**
 * Shhh-owned date range picker (no native date inputs).
 * Tap start, then end; reverse order normalizes to [min, max].
 */
export function DateRangeCalendar({ from, to, onChange }: DateRangeCalendarProps) {
  const initial = parseIsoDate(from || to) ?? {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    day: 1,
  };
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [anchor, setAnchor] = useState<string | null>(from && !to ? from : null);
  const [slideKey, setSlideKey] = useState(0);

  const range = useMemo(() => normalizeDateRange(from, to), [from, to]);
  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
        new Date(year, month - 1, 1),
      ),
    [year, month],
  );

  function shiftMonth(delta: number) {
    const date = new Date(year, month - 1 + delta, 1);
    setYear(date.getFullYear());
    setMonth(date.getMonth() + 1);
    setSlideKey((k) => k + 1);
  }

  function applyPreset(preset: DateRangePreset) {
    const next = dateRangeFromPreset(preset);
    setAnchor(null);
    onChange(next);
    if (next.from) {
      const p = parseIsoDate(next.from);
      if (p) {
        setYear(p.year);
        setMonth(p.month);
      }
    }
  }

  function onDayClick(iso: string) {
    if (!anchor && !range.from) {
      setAnchor(iso);
      onChange({ from: iso, to: "" });
      return;
    }
    if (anchor && !range.to) {
      const next = normalizeDateRange(anchor, iso);
      setAnchor(null);
      onChange(next);
      return;
    }
    // Restart range
    setAnchor(iso);
    onChange({ from: iso, to: "" });
  }

  const totalDays = daysInMonth(year, month);
  const offset = startWeekday(year, month);
  const summary = formatShortRangeLabel(range.from, range.to);

  return (
    <div className="grid gap-3" data-testid="date-range-calendar">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-secondary-text">Date</p>
        <p className="text-sm font-medium text-primary-text" aria-live="polite">
          {summary}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Date presets">
        {(
          [
            ["any", "Any time"],
            ["today", "Today"],
            ["last7", "Last 7 days"],
            ["thisMonth", "This month"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            data-testid={`date-preset-${id}`}
            className={cn(
              "shhh-press min-h-9 rounded-pill px-3 text-xs font-medium",
              "bg-bg-soft text-secondary-text transition-[background-color,color,transform]",
              "duration-[var(--shhh-motion-normal)] ease-[var(--shhh-ease-settle)]",
            )}
            onClick={() => applyPreset(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <ShhhIconButton type="button" label="Previous month" onClick={() => shiftMonth(-1)}>
          <ChevronLeft className="size-5" />
        </ShhhIconButton>
        <p className="text-sm font-semibold text-primary-text">{monthLabel}</p>
        <ShhhIconButton type="button" label="Next month" onClick={() => shiftMonth(1)}>
          <ChevronRight className="size-5" />
        </ShhhIconButton>
      </div>

      <div
        key={slideKey}
        className="animate-shhh-settle"
        role="grid"
        aria-label={`${monthLabel} calendar`}
      >
        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] text-muted-text">
          {WEEKDAY_LABELS.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: offset }).map((_, i) => (
            <span key={`pad-${i}`} />
          ))}
          {Array.from({ length: totalDays }).map((_, i) => {
            const day = i + 1;
            const iso = toIsoDate(year, month, day);
            const inRange =
              range.from &&
              range.to &&
              iso >= range.from &&
              iso <= range.to;
            const isStart = iso === range.from;
            const isEnd = iso === (range.to || range.from);
            const isSolo = Boolean(range.from && !range.to && iso === range.from);
            return (
              <button
                key={iso}
                type="button"
                role="gridcell"
                data-testid="date-range-day"
                data-date={iso}
                aria-label={iso}
                aria-selected={isStart || isEnd || isSolo}
                onClick={() => onDayClick(iso)}
                className={cn(
                  "shhh-day-cell relative flex min-h-11 min-w-11 items-center justify-center rounded-[1.1rem] text-sm",
                  "transition-[background-color,color,transform] duration-[var(--shhh-motion-normal)] ease-[var(--shhh-ease-settle)]",
                  inRange && !isStart && !isEnd && "bg-accent-soft/45 text-primary-text",
                  (isStart || isEnd || isSolo) && "bg-accent-soft text-accent scale-[1.03]",
                  !inRange && !isSolo && "text-primary-text hover:bg-bg-soft",
                )}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {(range.from || range.to) && (
        <ShhhButton
          type="button"
          variant="ghost"
          className="justify-self-start"
          data-testid="clear-dates"
          onClick={() => {
            setAnchor(null);
            onChange({ from: "", to: "" });
          }}
        >
          Clear dates
        </ShhhButton>
      )}
    </div>
  );
}
