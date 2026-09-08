import { describe, expect, it } from "vitest";

import {
  cloneDocument,
  countPoints,
  emptyDoodleDocument,
  newStrokeId,
  packPoints,
  payloadBytes,
  unpackPoints,
  type DoodleDocument,
  type DoodleStroke,
} from "@/lib/doodles/document";
import { eraseAlong, eraseAt } from "@/lib/doodles/erase";
import {
  appendPointIfFarEnough,
  effectiveWidth,
  pointToSegmentDistance,
  samplePointerPressure,
  simplifyPoints,
  strokePathD,
} from "@/lib/doodles/geometry";
import {
  canRedo,
  canUndo,
  commitClear,
  commitReplace,
  commitStroke,
  emptyHistory,
  redo,
  undo,
} from "@/lib/doodles/history";
import {
  DOODLE_ASPECT_RATIO,
  MAX_PAYLOAD_BYTES,
  MAX_STROKES,
  MAX_TOTAL_POINTS,
} from "@/lib/doodles/limits";
import {
  clampCoord,
  clampOpacity,
  clampPressure,
  clampWidth,
  DoodleValidationError,
  isSafeHexColor,
  parseDoodleDocument,
  parseDoodleDocumentLoose,
} from "@/lib/doodles/validation";

function stroke(partial: Partial<DoodleStroke> = {}): DoodleStroke {
  return {
    id: partial.id ?? "stroke-1",
    tool: partial.tool ?? "pen",
    color: partial.color ?? "#4a756c",
    width: partial.width ?? 0.02,
    opacity: partial.opacity ?? 1,
    points: partial.points ?? [0.1, 0.1, 0.5, 0.4, 0.2, 0.5, 0.7, 0.4, 0.5],
  };
}

function doc(strokes: DoodleStroke[]): DoodleDocument {
  return {
    version: 1,
    aspectRatio: DOODLE_ASPECT_RATIO,
    backgroundMode: "paper",
    strokes,
  };
}

describe("doodle document helpers", () => {
  it("packs and unpacks flat triples", () => {
    const points = packPoints([
      { x: 0.12345, y: 0.98765, pressure: 0.5555 },
      { x: 0.2, y: 0.3, pressure: 0.5 },
    ]);
    expect(points).toEqual([0.1235, 0.9877, 0.556, 0.2, 0.3, 0.5]);
    expect(unpackPoints(points)).toHaveLength(2);
  });

  it("counts points and payload size", () => {
    const document = doc([stroke()]);
    expect(countPoints(document)).toBe(3);
    expect(payloadBytes(document)).toBeGreaterThan(20);
  });
});

describe("validation", () => {
  it("accepts a version-1 document and clamps coordinates", () => {
    const parsed = parseDoodleDocument(
      doc([
        stroke({
          points: [1.4, -0.2, 2, 0.2, 0.3, 0.4],
        }),
      ]),
    );
    expect(parsed.strokes[0]?.points[0]).toBe(1);
    expect(parsed.strokes[0]?.points[1]).toBe(0);
    expect(parsed.strokes[0]?.points[2]).toBe(1);
  });

  it("rejects unknown versions and tools", () => {
    expect(() =>
      parseDoodleDocument({ ...doc([stroke()]), version: 99 }),
    ).toThrow(DoodleValidationError);
    expect(parseDoodleDocumentLoose({ ...doc([stroke({ tool: "laser" as never })]), })).toBeNull();
  });

  it("rejects CSS injection colors and unsafe values", () => {
    expect(isSafeHexColor("url(javascript:alert(1))")).toBe(false);
    expect(isSafeHexColor("var(--x)")).toBe(false);
    expect(isSafeHexColor("#4a756c")).toBe(true);
    expect(() => parseDoodleDocument(doc([stroke({ color: "red" })]))).toThrow(
      DoodleValidationError,
    );
    expect(clampCoord(Number.NaN)).toBe(0);
    expect(clampPressure(Number.POSITIVE_INFINITY)).toBe(0.5);
    expect(clampWidth(-4)).toBeGreaterThan(0);
    expect(clampOpacity(8)).toBe(1);
  });

  it("rejects oversized payloads and empty ink", () => {
    expect(() => parseDoodleDocument(emptyDoodleDocument())).toThrow(/Draw something first/);
    const huge = doc(
      Array.from({ length: MAX_STROKES + 1 }, (_, index) =>
        stroke({ id: `s-${index}`, points: [0.1, 0.1, 0.5] }),
      ),
    );
    expect(() => parseDoodleDocument(huge)).toThrow(/too big/);
    const manyPoints = doc([
      stroke({
        points: Array.from({ length: (MAX_TOTAL_POINTS + 10) * 3 }, (_, i) =>
          i % 3 === 2 ? 0.5 : (i % 97) / 100,
        ),
      }),
    ]);
    expect(() => parseDoodleDocument(manyPoints)).toThrow(/too big/);
    expect(MAX_PAYLOAD_BYTES).toBeGreaterThan(1_000);
  });
});

describe("geometry", () => {
  it("falls back pressure for mouse and respects stylus", () => {
    expect(samplePointerPressure({ pointerType: "mouse", pressure: 0 })).toBe(0.5);
    expect(samplePointerPressure({ pointerType: "pen", pressure: 0.8 })).toBe(0.8);
    expect(effectiveWidth(0.02, 0.5, "pen")).toBeCloseTo(0.02);
    expect(effectiveWidth(0.05, 0.1, "marker")).toBe(0.05);
  });

  it("simplifies dense handwriting without dropping endpoints", () => {
    const dense = Array.from({ length: 40 }, (_, i) => ({
      x: 0.1 + i * 0.0004,
      y: 0.2,
      pressure: 0.5,
    }));
    const simplified = simplifyPoints(dense);
    expect(simplified.length).toBeLessThan(dense.length);
    expect(simplified[0]?.x).toBeCloseTo(0.1);
    expect(simplified[simplified.length - 1]?.x).toBeCloseTo(0.1 + 39 * 0.0004);
  });

  it("builds a bounded SVG path and measures segment distance", () => {
    const path = strokePathD(stroke(), 400, 500);
    expect(path.startsWith("M ")).toBe(true);
    expect(path).toContain(" C ");
    expect(pointToSegmentDistance(0.5, 0.5, 0, 0.5, 1, 0.5)).toBeCloseTo(0);
    expect(appendPointIfFarEnough([{ x: 0, y: 0, pressure: 0.5 }], { x: 0.001, y: 0, pressure: 0.5 })).toHaveLength(
      1,
    );
  });

  it("preserves geometry across render sizes", () => {
    const small = strokePathD(stroke(), 320, 400);
    const large = strokePathD(stroke(), 430, 537.5);
    expect(small.match(/C/g)?.length).toBe(large.match(/C/g)?.length);
  });
});

describe("eraser", () => {
  it("splits a stroke through the middle and keeps the ends", () => {
    const line = stroke({
      id: "line",
      points: [0.1, 0.5, 0.5, 0.3, 0.5, 0.5, 0.5, 0.5, 0.5, 0.8, 0.5, 0.5],
    });
    const next = eraseAt([line], 0.5, 0.5, 0.04);
    expect(next.length).toBeGreaterThanOrEqual(2);
    expect(next.every((item) => item.id !== "line" || item.points.length < line.points.length)).toBe(
      true,
    );
  });

  it("erases along a path without dropping distant strokes", () => {
    const far = stroke({
      id: "far",
      points: [0.9, 0.1, 0.5, 0.92, 0.12, 0.5],
    });
    const near = stroke({
      id: "near",
      points: [0.2, 0.2, 0.5, 0.25, 0.25, 0.5],
    });
    const next = eraseAlong([far, near], [{ x: 0.22, y: 0.22 }], 0.05);
    expect(next.some((item) => item.id === "far")).toBe(true);
  });
});

describe("history", () => {
  it("undoes a stroke, redo restores, and new ink drops redo", () => {
    let state = emptyHistory();
    const first = stroke({ id: "a" });
    state = commitStroke(state, first);
    expect(state.strokes).toHaveLength(1);
    state = undo(state);
    expect(state.strokes).toHaveLength(0);
    expect(canRedo(state)).toBe(true);
    state = redo(state);
    expect(state.strokes[0]?.id).toBe("a");
    state = undo(state);
    state = commitStroke(state, stroke({ id: "b" }));
    expect(canRedo(state)).toBe(false);
    expect(state.strokes[0]?.id).toBe("b");
  });

  it("treats clear as one undoable action", () => {
    let state = commitStroke(emptyHistory(), stroke({ id: "a" }));
    state = commitStroke(state, stroke({ id: "b" }));
    state = commitClear(state);
    expect(state.strokes).toHaveLength(0);
    state = undo(state);
    expect(state.strokes).toHaveLength(2);
    expect(canUndo(state)).toBe(true);
  });

  it("stores erase as a replace snapshot", () => {
    const before = [stroke({ id: "keep" })];
    let state = emptyHistory(before);
    state = commitReplace(state, []);
    expect(state.strokes).toHaveLength(0);
    state = undo(state);
    expect(state.strokes[0]?.id).toBe("keep");
  });
});

describe("clone safety", () => {
  it("does not mutate the original document", () => {
    const original = doc([stroke({ id: newStrokeId() })]);
    const copy = cloneDocument(original);
    copy.strokes[0]!.points[0] = 0.99;
    expect(original.strokes[0]!.points[0]).toBe(0.1);
  });
});
