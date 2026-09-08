import { describe, expect, it } from "vitest";

import {
  formatGroupLabel,
  formatMediaTimestamp,
  groupByDate,
} from "@/features/media/date-groups";
import { dedupeById } from "@/features/media/media-utils";

const NOW = new Date(2026, 8, 1, 19, 22); // Sep 1 2026, local

function at(year: number, month: number, day: number, hour = 12) {
  return new Date(year, month - 1, day, hour).toISOString();
}

describe("media date grouping", () => {
  it("names recent days and collapses older ones into months", () => {
    expect(formatGroupLabel(new Date(2026, 8, 1, 8), NOW, "en-US")).toBe("Today");
    expect(formatGroupLabel(new Date(2026, 7, 31, 23), NOW, "en-US")).toBe("Yesterday");
    expect(formatGroupLabel(new Date(2026, 7, 4), NOW, "en-US")).toBe("August");
    expect(formatGroupLabel(new Date(2025, 6, 4), NOW, "en-US")).toBe("July 2025");
  });

  it("groups a newest-first list without reordering it", () => {
    const items = [
      { id: "a", createdAt: at(2026, 9, 1, 18) },
      { id: "b", createdAt: at(2026, 9, 1, 9) },
      { id: "c", createdAt: at(2026, 8, 31, 20) },
      { id: "d", createdAt: at(2026, 8, 12) },
      { id: "e", createdAt: at(2026, 8, 3) },
      { id: "f", createdAt: at(2026, 7, 9) },
    ];

    const groups = groupByDate(items, NOW, "en-US");

    expect(groups.map((group) => group.label)).toEqual([
      "Today",
      "Yesterday",
      "August",
      "July",
    ]);
    expect(groups[0]?.items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(groups[2]?.items.map((item) => item.id)).toEqual(["d", "e"]);
    // Every item lands in exactly one group.
    expect(groups.flatMap((group) => group.items)).toHaveLength(items.length);
  });

  it("skips unparseable timestamps instead of crashing the grid", () => {
    const groups = groupByDate(
      [{ id: "bad", createdAt: "not-a-date" }, { id: "ok", createdAt: at(2026, 9, 1) }],
      NOW,
      "en-US",
    );
    expect(groups.flatMap((group) => group.items).map((item) => item.id)).toEqual(["ok"]);
  });

  it("formats viewer timestamps humanely, never as ISO", () => {
    const label = formatMediaTimestamp(at(2026, 9, 1, 19), "en-US");
    expect(label).toContain("Sep 1, 2026");
    expect(label).toContain("·");
    expect(label).not.toContain("T");
  });
});

describe("pagination dedupe", () => {
  it("keeps the first occurrence when pages overlap", () => {
    const merged = dedupeById([
      { id: "a", n: 1 },
      { id: "b", n: 2 },
      { id: "a", n: 3 },
      { id: "c", n: 4 },
    ]);
    expect(merged.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(merged[0]?.n).toBe(1);
  });
});
