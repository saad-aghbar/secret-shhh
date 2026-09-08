import { describe, expect, it } from "vitest";

import { callDurationMs, elapsedSince, formatCallDuration, formatCallDurationLabel } from "@/lib/calls/duration";

describe("call duration", () => {
  it("computes server duration from answeredAt to endedAt only", () => {
    expect(callDurationMs(null, new Date())).toBeNull();
    expect(
      callDurationMs("2026-09-06T10:00:00.000Z", "2026-09-06T10:01:30.000Z"),
    ).toBe(90_000);
    expect(callDurationMs("2026-09-06T10:02:00.000Z", "2026-09-06T10:01:00.000Z")).toBe(0);
  });

  it("formats clocks and history labels", () => {
    expect(formatCallDuration(null)).toBe("0:00");
    expect(formatCallDuration(38_000)).toBe("0:38");
    expect(formatCallDuration(38 * 60_000)).toBe("38:00");
    expect(formatCallDuration(3_660_000)).toBe("1:01:00");
    expect(formatCallDurationLabel(500)).toBe("");
    expect(formatCallDurationLabel(38 * 60_000)).toBe("38 min");
    expect(formatCallDurationLabel(3_600_000)).toBe("1 hr");
  });

  it("elapsedSince never goes negative", () => {
    expect(elapsedSince(null)).toBe(0);
    expect(elapsedSince("2026-09-06T10:00:00.000Z", Date.parse("2026-09-06T09:59:00.000Z"))).toBe(0);
    expect(elapsedSince("2026-09-06T10:00:00.000Z", Date.parse("2026-09-06T10:00:05.000Z"))).toBe(5_000);
  });
});
