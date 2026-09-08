/**
 * Human date grouping for the media library: Today / Yesterday for recent
 * memories, "Month Year" once things settle into the past. Locale-aware and
 * computed in the viewer's local zone so a late-night photo lands on the day
 * it felt like.
 */

export type MediaDateGroup<T> = {
  key: string;
  label: string;
  items: T[];
};

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function formatGroupLabel(date: Date, now = new Date(), locale?: string): string {
  const today = startOfLocalDay(now);
  const day = startOfLocalDay(date);
  const dayMs = 24 * 60 * 60 * 1000;

  if (day === today) return "Today";
  if (day === today - dayMs) return "Yesterday";

  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(date);
}

/** Groups an already-sorted list without reordering it — RTL never flips chronology. */
export function groupByDate<T extends { createdAt: string }>(
  items: T[],
  now = new Date(),
  locale?: string,
): MediaDateGroup<T>[] {
  const groups: MediaDateGroup<T>[] = [];
  let current: MediaDateGroup<T> | null = null;

  for (const item of items) {
    const date = new Date(item.createdAt);
    if (Number.isNaN(date.getTime())) continue;

    const today = startOfLocalDay(now);
    const day = startOfLocalDay(date);
    const dayMs = 24 * 60 * 60 * 1000;
    // Recent days stay distinct; older photos collapse into their month.
    const key =
      day === today ? "today" : day === today - dayMs ? "yesterday" : monthKey(date);

    if (!current || current.key !== key) {
      current = { key, label: formatGroupLabel(date, now, locale), items: [] };
      groups.push(current);
    }
    current.items.push(item);
  }

  return groups;
}

/** Viewer / detail context line: "Sep 1, 2026 · 7:22 PM" — never an ISO string. */
export function formatMediaTimestamp(iso: string, locale?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${day} · ${time}`;
}
