const HOUR = 3_600_000;
const MINUTE = 60_000;
const SECOND = 1_000;

export function callDurationMs(answeredAt: string | Date | null, endedAt: string | Date | null) {
  if (!answeredAt || !endedAt) return null;
  const start = answeredAt instanceof Date ? answeredAt.getTime() : Date.parse(answeredAt);
  const end = endedAt instanceof Date ? endedAt.getTime() : Date.parse(endedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return end - start;
}

export function formatCallDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "0:00";
  const totalSeconds = Math.floor(ms / SECOND);
  const hours = Math.floor((totalSeconds * SECOND) / HOUR);
  const minutes = Math.floor((totalSeconds * SECOND - hours * HOUR) / MINUTE);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => value.toString().padStart(2, "0");
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}

export function formatCallDurationLabel(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 1_000) return "";
  const totalSeconds = Math.floor(ms / SECOND);
  const hours = Math.floor((totalSeconds * SECOND) / HOUR);
  const minutes = Math.floor((totalSeconds * SECOND - hours * HOUR) / MINUTE);
  if (hours > 0) {
    const leftover = minutes;
    return leftover > 0 ? `${hours} hr ${leftover} min` : `${hours} hr`;
  }
  return `${Math.max(1, minutes)} min`;
}

export function elapsedSince(iso: string | null, now = Date.now()): number {
  if (!iso) return 0;
  const start = Date.parse(iso);
  if (!Number.isFinite(start) || now < start) return 0;
  return now - start;
}
