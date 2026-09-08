import { describe, expect, it } from "vitest";

import {
  addDaysIso,
  dateRangeFromPreset,
  normalizeDateRange,
  toIsoDate,
} from "@/components/shhh/day-grid";
import { countActiveFilters, DEFAULT_SEARCH_FILTERS } from "@/features/search/filter-utils";

describe("normalizeDateRange", () => {
  it("keeps chronological order", () => {
    expect(normalizeDateRange("2026-08-05", "2026-08-14")).toEqual({
      from: "2026-08-05",
      to: "2026-08-14",
    });
  });

  it("normalizes reverse taps to min/max", () => {
    expect(normalizeDateRange("2026-08-14", "2026-08-05")).toEqual({
      from: "2026-08-05",
      to: "2026-08-14",
    });
  });

  it("treats single bound as same-day when only one provided", () => {
    expect(normalizeDateRange("2026-08-05", "")).toEqual({
      from: "2026-08-05",
      to: "2026-08-05",
    });
  });
});

describe("countActiveFilters", () => {
  it("counts sender, type, and date categories", () => {
    expect(countActiveFilters(DEFAULT_SEARCH_FILTERS)).toBe(0);
    expect(countActiveFilters({ ...DEFAULT_SEARCH_FILTERS, type: "videos" })).toBe(1);
    expect(
      countActiveFilters({
        sender: "partner",
        type: "links",
        from: "2026-08-01",
        to: "2026-08-10",
      }),
    ).toBe(3);
  });
});

describe("dateRangeFromPreset", () => {
  it("computes local presets from a fixed now", () => {
    const now = new Date(2026, 8, 15); // Sep 15, 2026 local
    expect(dateRangeFromPreset("any", now)).toEqual({ from: "", to: "" });
    expect(dateRangeFromPreset("today", now)).toEqual({
      from: "2026-09-15",
      to: "2026-09-15",
    });
    expect(dateRangeFromPreset("last7", now)).toEqual({
      from: "2026-09-09",
      to: "2026-09-15",
    });
    expect(dateRangeFromPreset("thisMonth", now)).toEqual({
      from: "2026-09-01",
      to: "2026-09-15",
    });
  });

  it("addDaysIso crosses month boundaries", () => {
    expect(addDaysIso("2026-09-01", -1)).toBe("2026-08-31");
    expect(toIsoDate(2026, 2, 1)).toBe("2026-02-01");
  });
});
