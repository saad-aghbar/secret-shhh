import { describe, expect, it } from "vitest";

import { isServerLocked, LOCK_GRACE_MS, shouldEngageLock } from "@/lib/privacy/policy";

describe("shouldEngageLock", () => {
  it("waits for the grace window", () => {
    expect(
      shouldEngageLock({ hiddenAtMs: 1_000, nowMs: 1_000 + LOCK_GRACE_MS - 1, lockOnLeave: true }),
    ).toBe(false);
    expect(
      shouldEngageLock({ hiddenAtMs: 1_000, nowMs: 1_000 + LOCK_GRACE_MS, lockOnLeave: true }),
    ).toBe(true);
  });

  it("stays off when lock-on-leave is disabled or hide time is missing", () => {
    expect(
      shouldEngageLock({ hiddenAtMs: 1, nowMs: 1 + LOCK_GRACE_MS * 4, lockOnLeave: false }),
    ).toBe(false);
    expect(shouldEngageLock({ hiddenAtMs: null, nowMs: 20_000, lockOnLeave: true })).toBe(false);
  });
});

describe("isServerLocked", () => {
  it("locks from the lock cookie or a stale hidden-at cookie", () => {
    expect(
      isServerLocked({ lockCookie: "1", hiddenAtCookie: null, lockOnLeave: false }),
    ).toBe(true);
    expect(
      isServerLocked({
        lockCookie: null,
        hiddenAtCookie: String(1_000),
        lockOnLeave: true,
        nowMs: 1_000 + LOCK_GRACE_MS,
      }),
    ).toBe(true);
    expect(
      isServerLocked({
        lockCookie: null,
        hiddenAtCookie: String(1_000),
        lockOnLeave: true,
        nowMs: 1_000 + 1_000,
      }),
    ).toBe(false);
    expect(
      isServerLocked({
        lockCookie: null,
        hiddenAtCookie: String(1_000),
        lockOnLeave: true,
        nowMs: 1_000 + LOCK_GRACE_MS,
        ignoreHiddenAt: true,
      }),
    ).toBe(false);
    expect(
      isServerLocked({
        lockCookie: "1",
        hiddenAtCookie: String(1_000),
        lockOnLeave: true,
        ignoreHiddenAt: true,
      }),
    ).toBe(true);
  });
});
