import { describe, expect, it } from "vitest";

import {
  formatZonedDate,
  isValidTimeZone,
  monthRangeUtc,
  parseIsoDate,
  zonedDayBounds,
} from "@/lib/history/timezone";
import { makeSearchSnippet, parseSearchQuery } from "@/lib/search/snippets";

describe("history timezone", () => {
  it("validates IANA timezones", () => {
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Asia/Hebron")).toBe(true);
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
  });

  it("rejects impossible calendar dates", () => {
    expect(parseIsoDate("2026-02-31")).toBeNull();
    expect(parseIsoDate("2026-09-01")).toEqual({ year: 2026, month: 9, day: 1 });
  });

  it("maps local day to UTC bounds ahead of UTC", () => {
    const { start, nextStart } = zonedDayBounds("2026-09-01", "Asia/Hebron");
    expect(start.toISOString()).toBe("2026-08-31T21:00:00.000Z");
    expect(nextStart.toISOString()).toBe("2026-09-01T21:00:00.000Z");
  });

  it("maps local day to UTC bounds behind UTC", () => {
    const { start, nextStart } = zonedDayBounds("2026-09-01", "America/New_York");
    // EDT: UTC-4
    expect(start.toISOString()).toBe("2026-09-01T04:00:00.000Z");
    expect(nextStart.toISOString()).toBe("2026-09-02T04:00:00.000Z");
  });

  it("handles month and year boundaries", () => {
    const dec = monthRangeUtc(2025, 12, "UTC");
    expect(dec.start.toISOString()).toBe("2025-12-01T00:00:00.000Z");
    expect(dec.nextStart.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("formats zoned dates", () => {
    expect(formatZonedDate(new Date("2026-09-01T21:30:00.000Z"), "Asia/Hebron")).toBe(
      "2026-09-02",
    );
  });

  it("handles a US DST spring-forward local midnight", () => {
    // 2026-03-08 America/New_York — DST begins; local midnight still exists.
    const { start, nextStart } = zonedDayBounds("2026-03-08", "America/New_York");
    expect(start.toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(nextStart.getTime()).toBeGreaterThan(start.getTime());
  });
});

describe("search snippets", () => {
  it("parses quoted phrases", () => {
    expect(parseSearchQuery('"good night"')).toEqual({ mode: "phrase", text: "good night" });
    expect(parseSearchQuery("love")).toEqual({ mode: "terms", text: "love" });
  });

  it("truncates safely and reports match offsets", () => {
    const { snippet, matchStart, matchEnd } = makeSearchSnippet("I love you كتير", "love");
    expect(snippet).toContain("love");
    expect(matchStart).toBeGreaterThanOrEqual(0);
    expect(matchEnd).toBeGreaterThan(matchStart!);
  });
});
