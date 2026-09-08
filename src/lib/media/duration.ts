/**
 * Clock copy for voice, video, and camera timers.
 *
 * `0` is a real time (`0:00`), not “missing”. Missing/invalid values return
 * an empty string so the caller can decide whether to hide the clock.
 * Valid voice notes are ≥700ms, which rounds to `0:01`.
 */
export function formatDurationMs(ms: number | string | null | undefined) {
  if (ms == null || ms === "") return "";
  const n = typeof ms === "number" ? ms : Number(ms);
  if (!Number.isFinite(n) || n < 0) return "";
  const total = Math.max(0, Math.round(n / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
