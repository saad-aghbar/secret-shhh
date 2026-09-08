import {
  DEFAULT_MARKER_OPACITY,
  DEFAULT_MARKER_WIDTH,
  DEFAULT_PEN_OPACITY,
  DEFAULT_PEN_WIDTH,
  DOODLE_ASPECT_RATIO,
  DOODLE_BACKGROUND_MODE,
  DOODLE_VECTOR_VERSION,
} from "@/lib/doodles/limits";

export type DoodleTool = "pen" | "marker";
export type DoodleEditorTool = DoodleTool | "eraser";
export type DoodleBackgroundMode = typeof DOODLE_BACKGROUND_MODE;

export type DoodlePoint = {
  x: number;
  y: number;
  pressure: number;
};

export type DoodleStroke = {
  id: string;
  tool: DoodleTool;
  color: string;
  width: number;
  opacity: number;
  points: number[];
};

export type DoodleDocument = {
  version: typeof DOODLE_VECTOR_VERSION;
  aspectRatio: number;
  backgroundMode: DoodleBackgroundMode;
  strokes: DoodleStroke[];
};

export function emptyDoodleDocument(): DoodleDocument {
  return {
    version: DOODLE_VECTOR_VERSION,
    aspectRatio: DOODLE_ASPECT_RATIO,
    backgroundMode: DOODLE_BACKGROUND_MODE,
    strokes: [],
  };
}

export function newStrokeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `s-${Math.random().toString(36).slice(2, 12)}`;
}

export function unpackPoints(points: number[]): DoodlePoint[] {
  const out: DoodlePoint[] = [];
  for (let i = 0; i + 2 < points.length; i += 3) {
    out.push({
      x: points[i]!,
      y: points[i + 1]!,
      pressure: points[i + 2]!,
    });
  }
  return out;
}

export function packPoints(points: DoodlePoint[]): number[] {
  const out: number[] = [];
  for (const point of points) {
    out.push(roundCoord(point.x), roundCoord(point.y), roundPressure(point.pressure));
  }
  return out;
}

export function roundCoord(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function roundPressure(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

export function countPoints(document: Pick<DoodleDocument, "strokes">): number {
  let total = 0;
  for (const stroke of document.strokes) {
    total += Math.floor(stroke.points.length / 3);
  }
  return total;
}

export function payloadBytes(document: DoodleDocument): number {
  return new TextEncoder().encode(JSON.stringify(document)).length;
}

export function documentHasInk(document: Pick<DoodleDocument, "strokes">): boolean {
  return document.strokes.some((stroke) => stroke.points.length >= 3);
}

export function defaultWidthFor(tool: DoodleTool): number {
  return tool === "marker" ? DEFAULT_MARKER_WIDTH : DEFAULT_PEN_WIDTH;
}

export function defaultOpacityFor(tool: DoodleTool): number {
  return tool === "marker" ? DEFAULT_MARKER_OPACITY : DEFAULT_PEN_OPACITY;
}

export function cloneDocument(document: DoodleDocument): DoodleDocument {
  return {
    version: document.version,
    aspectRatio: document.aspectRatio,
    backgroundMode: document.backgroundMode,
    strokes: document.strokes.map((stroke) => ({
      ...stroke,
      points: stroke.points.slice(),
    })),
  };
}

export function cloneStrokes(strokes: DoodleStroke[]): DoodleStroke[] {
  return strokes.map((stroke) => ({
    ...stroke,
    points: stroke.points.slice(),
  }));
}
