export const LOCK_GRACE_MS = 15_000;

export function shouldEngageLock(input: {
  hiddenAtMs: number | null;
  nowMs: number;
  lockOnLeave: boolean;
  graceMs?: number;
}): boolean {
  if (!input.lockOnLeave || input.hiddenAtMs == null) {
    return false;
  }
  const grace = input.graceMs ?? LOCK_GRACE_MS;
  return input.nowMs - input.hiddenAtMs >= grace;
}

export function isServerLocked(input: {
  lockCookie: string | null | undefined;
  hiddenAtCookie: string | null | undefined;
  lockOnLeave: boolean;
  nowMs?: number;
  graceMs?: number;
  /** Same-origin navigations also fire pagehide; that is not "left the app". */
  ignoreHiddenAt?: boolean;
}): boolean {
  if (input.lockCookie === "1") {
    return true;
  }
  if (input.ignoreHiddenAt) {
    return false;
  }
  const hiddenAtMs = Number(input.hiddenAtCookie);
  if (!Number.isFinite(hiddenAtMs)) {
    return false;
  }
  return shouldEngageLock({
    hiddenAtMs,
    nowMs: input.nowMs ?? Date.now(),
    lockOnLeave: input.lockOnLeave,
    graceMs: input.graceMs,
  });
}
