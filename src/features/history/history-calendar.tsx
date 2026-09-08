"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  daysInMonth,
  startWeekday,
  toIsoDate,
  todayIsoLocal,
  WEEKDAY_LABELS,
} from "@/components/shhh/day-grid";
import {
  ShhhButton,
  ShhhEmptyState,
  ShhhIconButton,
  ShhhSpinner,
  ShhhSurface,
} from "@/components/shhh";
import { chatFocusHref } from "@/features/chat/focus-navigation";
import { SoftMessageRow } from "@/features/search/soft-message-row";
import { formatChatDateLabel } from "@/lib/chat/layout";
import {
  apiHistoryAdjacent,
  apiHistoryDayMessages,
  apiHistoryMonth,
} from "@/lib/search/client-api";
import { cn } from "@/lib/utils";

const monthTitle = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

/** A day row is a text preview; a recording or an uncaptioned photo says what it was. */
function mediaLabel(type: string): string {
  if (type === "audio") return "Voice message";
  if (type === "video") return "Video";
  if (type === "image") return "Photo";
  return "Message";
}

type HistoryCalendarProps = {
  year?: number;
  month?: number;
  viewerId: string;
  partnerName: string;
  onMonthChange?: (year: number, month: number) => void;
};

/**
 * Mobile-first History: select a day → show that day's messages → row tap opens Chat.
 * Never auto-jumps to Chat on day tap.
 */
export function HistoryCalendar({
  year: yearProp,
  month: monthProp,
  viewerId,
  partnerName,
  onMonthChange,
}: HistoryCalendarProps) {
  const router = useRouter();
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const now = new Date();
  const year = yearProp ?? now.getFullYear();
  const month = monthProp ?? now.getMonth() + 1;
  const [selected, setSelected] = useState<string | null>(null);
  const [quiet, setQuiet] = useState(false);
  const [quietPulse, setQuietPulse] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [slideKey, setSlideKey] = useState(0);
  const hydratedUrl = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hydratedUrl.current) return;
    if (yearProp && monthProp) {
      hydratedUrl.current = true;
      return;
    }
    hydratedUrl.current = true;
    onMonthChange?.(year, month);
  }, [month, monthProp, onMonthChange, year, yearProp]);

  const monthQuery = useQuery({
    queryKey: ["history-month", year, month, tz],
    queryFn: () => apiHistoryMonth(year, month, tz),
  });

  const dayQuery = useQuery({
    queryKey: ["history-day", selected, tz],
    queryFn: () => apiHistoryDayMessages(selected!, tz),
    enabled: Boolean(selected),
  });

  const activity = useMemo(() => {
    const map = new Map<string, number>();
    for (const day of monthQuery.data?.days ?? []) {
      map.set(day.date, day.count);
    }
    return map;
  }, [monthQuery.data?.days]);

  function commitMonth(nextYear: number, nextMonth: number) {
    setSelected(null);
    setQuiet(false);
    setActionError(null);
    setSlideKey((k) => k + 1);
    onMonthChange?.(nextYear, nextMonth);
  }

  function shiftMonth(delta: number) {
    const date = new Date(year, month - 1 + delta, 1);
    commitMonth(date.getFullYear(), date.getMonth() + 1);
  }

  function selectDay(date: string, active: boolean) {
    setActionError(null);
    setSelected(date);
    if (!active) {
      setQuiet(true);
      setQuietPulse(true);
      window.setTimeout(() => setQuietPulse(false), 480);
      return;
    }
    setQuiet(false);
    window.requestAnimationFrame(() => {
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  async function adjacent(dir: "prev" | "next") {
    const anchor = selected ?? todayIsoLocal(tz);
    try {
      const { day } = await apiHistoryAdjacent(anchor, tz, dir);
      if (!day) {
        return;
      }
      const [y, m] = day.date.split("-").map(Number);
      if (y && m && (y !== year || m !== month)) {
        setSlideKey((k) => k + 1);
        onMonthChange?.(y, m);
      }
      setActionError(null);
      setQuiet(false);
      setSelected(day.date);
      window.requestAnimationFrame(() => {
        listRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } catch {
      setActionError("Couldn’t find another day.");
    }
  }

  function goToday() {
    const date = todayIsoLocal(tz);
    const [y, m] = date.split("-").map(Number);
    if (y && m && (y !== year || m !== month)) {
      setSlideKey((k) => k + 1);
      onMonthChange?.(y, m);
    }
    setActionError(null);
    setQuiet(false);
    setSelected(date);
    window.requestAnimationFrame(() => {
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  const totalDays = daysInMonth(year, month);
  const offset = startWeekday(year, month);
  const dayMessages = dayQuery.data?.messages ?? [];
  const selectedCount = selected ? (activity.get(selected) ?? dayMessages.length) : undefined;
  const showQuiet =
    Boolean(selected) &&
    (quiet ||
      (!dayQuery.isLoading &&
        !dayQuery.isFetching &&
        dayQuery.isSuccess &&
        dayMessages.length === 0));
  const error =
    actionError ??
    (monthQuery.isError ? "Couldn’t load this month." : null) ??
    (dayQuery.isError ? "Couldn’t load that day." : null);

  return (
    <div className="grid gap-3 sm:gap-4" data-testid="history-calendar">
      <div className="flex items-center justify-between gap-2">
        <ShhhIconButton
          type="button"
          label="Previous month"
          className="shhh-press"
          onClick={() => shiftMonth(-1)}
        >
          <ChevronLeft className="size-5" />
        </ShhhIconButton>
        <p className="text-primary-text text-base font-semibold">
          {monthTitle.format(new Date(year, month - 1, 1))}
        </p>
        <ShhhIconButton
          type="button"
          label="Next month"
          className="shhh-press"
          onClick={() => shiftMonth(1)}
        >
          <ChevronRight className="size-5" />
        </ShhhIconButton>
      </div>

      <div className="flex flex-wrap gap-2">
        <ShhhButton
          type="button"
          variant="secondary"
          className="shhh-press"
          onClick={() => void adjacent("prev")}
        >
          Previous
        </ShhhButton>
        <ShhhButton
          type="button"
          variant="secondary"
          className="shhh-press"
          onClick={() => goToday()}
        >
          Today
        </ShhhButton>
        <ShhhButton
          type="button"
          variant="secondary"
          className="shhh-press"
          onClick={() => void adjacent("next")}
        >
          Next
        </ShhhButton>
      </div>

      {error ? (
        <div className="grid gap-2 text-center">
          <p className="text-secondary-text text-sm">{error}</p>
          <ShhhButton
            type="button"
            variant="ghost"
            onClick={() => {
              void monthQuery.refetch();
              void dayQuery.refetch();
            }}
          >
            Try again
          </ShhhButton>
        </div>
      ) : null}

      <ShhhSurface tone="soft" round="xl" padding="md" className="animate-shhh-settle">
        {monthQuery.isLoading ? (
          <div className="flex justify-center py-10">
            <ShhhSpinner label="Loading month" />
          </div>
        ) : (
          <div key={slideKey} className="animate-shhh-settle">
            <div className="text-muted-text mb-2 grid grid-cols-7 gap-1 text-center text-[11px]">
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
                const count = activity.get(iso) ?? 0;
                const active = count > 0;
                const isSelected = selected === iso;
                return (
                  <button
                    key={iso}
                    type="button"
                    data-testid="history-day"
                    data-date={iso}
                    data-active={active ? "true" : "false"}
                    aria-label={`${iso}${active ? `, ${count} messages` : ", quiet"}`}
                    onClick={() => selectDay(iso, active)}
                    className={cn(
                      "shhh-day-cell shhh-press relative flex min-h-11 min-w-11 flex-col items-center justify-center rounded-[1.1rem] text-sm",
                      "transition-[background-color,color,transform] duration-[var(--shhh-motion-normal)] ease-[var(--shhh-ease-settle)]",
                      isSelected && "bg-accent-soft text-accent scale-[1.03]",
                      !isSelected &&
                        active &&
                        "bg-surface-elevated text-primary-text shadow-[var(--shhh-shadow-soft)]",
                      !isSelected && !active && "text-muted-text",
                      quietPulse && isSelected && !active && "animate-shhh-quiet-pulse",
                    )}
                  >
                    {day}
                    {active ? (
                      <span className="bg-accent mt-0.5 size-1 rounded-full" aria-hidden />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </ShhhSurface>

      <div ref={listRef} className="grid gap-2 md:gap-2.5" data-testid="history-day-panel">
        {showQuiet ? (
          <div className={cn(quietPulse && "animate-shhh-settle")}>
            <ShhhEmptyState title="Quiet day." description="Nothing was sent on this date." />
          </div>
        ) : null}

        {selected && !showQuiet ? (
          <div className="animate-shhh-settle grid gap-2 md:gap-2.5">
            <div className="px-1">
              <p className="text-primary-text text-sm font-medium">
                {formatChatDateLabel(`${selected}T12:00:00.000Z`)}
              </p>
              {selectedCount != null ? (
                <p className="text-secondary-text text-xs">
                  {selectedCount} {selectedCount === 1 ? "message" : "messages"}
                </p>
              ) : null}
            </div>

            {dayQuery.isLoading || dayQuery.isFetching ? (
              <div className="flex justify-center py-8">
                <ShhhSpinner label="Loading day" />
              </div>
            ) : (
              <div className="grid gap-2 md:gap-2.5" data-testid="history-day-messages">
                {dayMessages.map((message) => (
                  <SoftMessageRow
                    key={message.id}
                    testId="history-day-message"
                    messageId={message.id}
                    senderLabel={message.senderId === viewerId ? "Me" : partnerName}
                    createdAt={message.createdAt}
                    showDate={false}
                    onActivate={() => router.push(chatFocusHref(message.id, "history"))}
                  >
                    {message.deletedAt ? (
                      <span className="text-muted-text italic">Message deleted</span>
                    ) : message.textContent?.trim() ? (
                      message.textContent
                    ) : (
                      <span className="text-secondary-text italic">{mediaLabel(message.type)}</span>
                    )}
                  </SoftMessageRow>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
