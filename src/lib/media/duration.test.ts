import { describe, expect, it } from "vitest";

import { formatDurationMs } from "@/lib/media/duration";

describe("formatDurationMs", () => {
  it("formats a six-second note as 0:06, never empty", () => {
    expect(formatDurationMs(6_000)).toBe("0:06");
    expect(formatDurationMs("6000")).toBe("0:06");
  });

  it("treats zero as a clock, not as missing", () => {
    expect(formatDurationMs(0)).toBe("0:00");
  });

  it("rounds a valid sub-second take up to 0:01", () => {
    expect(formatDurationMs(700)).toBe("0:01");
    expect(formatDurationMs(999)).toBe("0:01");
  });

  it("hides missing or invalid values", () => {
    expect(formatDurationMs(null)).toBe("");
    expect(formatDurationMs(undefined)).toBe("");
    expect(formatDurationMs(Number.NaN)).toBe("");
    expect(formatDurationMs(-12)).toBe("");
    expect(formatDurationMs("")).toBe("");
  });

  it("formats minutes and hours without jargon", () => {
    expect(formatDurationMs(59_000)).toBe("0:59");
    expect(formatDurationMs(63_000)).toBe("1:03");
    expect(formatDurationMs(768_000)).toBe("12:48");
    expect(formatDurationMs(3_661_000)).toBe("1:01:01");
  });
});
