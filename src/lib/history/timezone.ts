/**
 * Timezone-correct local calendar day boundaries.
 * Messages are stored in UTC; history navigation uses the user's IANA timezone.
 * No server-local TZ assumptions.
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function parseIsoDate(date: string): { year: number; month: number; day: number } | null {
  const match = DATE_RE.exec(date);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  // Reject impossible calendar dates (e.g. 2026-02-31).
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

/**
 * Returns UTC instants [start, nextStart) for a local calendar date in `timeZone`.
 */
export function zonedDayBounds(
  isoDate: string,
  timeZone: string,
): { start: Date; nextStart: Date } {
  if (!isValidTimeZone(timeZone)) {
    throw new Error("Invalid timezone.");
  }
  const parts = parseIsoDate(isoDate);
  if (!parts) {
    throw new Error("Invalid date.");
  }

  const start = zonedLocalTimeToUtc(parts.year, parts.month, parts.day, 0, 0, 0, timeZone);
  // Next calendar day (handles month/year edges).
  const nextLocal = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  const nextStart = zonedLocalTimeToUtc(
    nextLocal.getUTCFullYear(),
    nextLocal.getUTCMonth() + 1,
    nextLocal.getUTCDate(),
    0,
    0,
    0,
    timeZone,
  );
  return { start, nextStart };
}

/**
 * Convert a wall-clock local datetime in `timeZone` to a UTC Date.
 * Uses iterative offset correction (handles DST).
 */
export function zonedLocalTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  // First guess: treat components as UTC.
  let utc = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 3; i += 1) {
    const offsetMs = getTimeZoneOffsetMs(new Date(utc), timeZone);
    const asLocal = utc + offsetMs;
    const desired = Date.UTC(year, month - 1, day, hour, minute, second);
    const delta = desired - asLocal;
    if (Math.abs(delta) < 1) {
      break;
    }
    utc += delta;
  }
  return new Date(utc);
}

export function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return asUtc - date.getTime();
}

/** Format a UTC instant as YYYY-MM-DD in the given timezone. */
export function formatZonedDate(date: Date, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // en-CA yields YYYY-MM-DD
  return dtf.format(date);
}

export function monthRangeUtc(
  year: number,
  month: number,
  timeZone: string,
): { start: Date; nextStart: Date } {
  if (!isValidTimeZone(timeZone) || month < 1 || month > 12) {
    throw new Error("Invalid month range.");
  }
  const start = zonedLocalTimeToUtc(year, month, 1, 0, 0, 0, timeZone);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextStart = zonedLocalTimeToUtc(nextYear, nextMonth, 1, 0, 0, 0, timeZone);
  return { start, nextStart };
}
