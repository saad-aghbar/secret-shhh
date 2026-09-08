/** Shared calendar day-grid math (History single-select + Search range). */

export function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function startWeekday(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay();
}

export function toIsoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseIsoDate(iso: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/** If second < first, normalize to [min, max]. */
export function normalizeDateRange(a: string, b: string): { from: string; to: string } {
  if (!a && !b) return { from: "", to: "" };
  if (a && !b) return { from: a, to: a };
  if (!a && b) return { from: b, to: b };
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

export function todayIsoLocal(timeZone?: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function addDaysIso(iso: string, delta: number): string {
  const parsed = parseIsoDate(iso);
  if (!parsed) return iso;
  const date = new Date(parsed.year, parsed.month - 1, parsed.day);
  date.setDate(date.getDate() + delta);
  return toIsoDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export type DateRangePreset = "any" | "today" | "last7" | "thisMonth";

export function dateRangeFromPreset(
  preset: DateRangePreset,
  now = new Date(),
): { from: string; to: string } {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const today = toIsoDate(y, m, d);
  if (preset === "any") return { from: "", to: "" };
  if (preset === "today") return { from: today, to: today };
  if (preset === "last7") return { from: addDaysIso(today, -6), to: today };
  return { from: toIsoDate(y, m, 1), to: today };
}

export function formatShortRangeLabel(from: string, to: string): string {
  if (!from && !to) return "Any time";
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  const label = (iso: string) => {
    const p = parseIsoDate(iso);
    if (!p) return iso;
    return fmt.format(new Date(p.year, p.month - 1, p.day));
  };
  if (from && to && from === to) return label(from);
  if (from && to) return `${label(from)} – ${label(to)}`;
  return label(from || to);
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
