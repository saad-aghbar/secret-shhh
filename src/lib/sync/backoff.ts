const DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000];

/** Bounded exponential backoff with jitter. Never tight-loop retries. */
export function backoffMs(retryCount: number): number {
  const index = Math.min(Math.max(retryCount, 0), DELAYS_MS.length - 1);
  const cap = DELAYS_MS[index] ?? 30_000;
  const jitter = cap * 0.25 * Math.random();
  return Math.round(cap - jitter);
}

export const MAX_AUTO_RETRIES = DELAYS_MS.length;
