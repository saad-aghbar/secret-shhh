import { newStrokeId, packPoints, unpackPoints, type DoodlePoint, type DoodleStroke } from "@/lib/doodles/document";
import { pointToSegmentDistance } from "@/lib/doodles/geometry";

const GRID = 0.08;

function cellKey(x: number, y: number): string {
  return `${Math.floor(x / GRID)}:${Math.floor(y / GRID)}`;
}

function nearbyKeys(x: number, y: number, radius: number): string[] {
  const pad = Math.max(1, Math.ceil(radius / GRID) + 1);
  const cx = Math.floor(x / GRID);
  const cy = Math.floor(y / GRID);
  const keys: string[] = [];
  for (let iy = cy - pad; iy <= cy + pad; iy += 1) {
    for (let ix = cx - pad; ix <= cx + pad; ix += 1) {
      keys.push(`${ix}:${iy}`);
    }
  }
  return keys;
}

function indexStrokes(strokes: DoodleStroke[]): Map<string, Set<string>> {
  const grid = new Map<string, Set<string>>();
  for (const stroke of strokes) {
    const points = unpackPoints(stroke.points);
    for (const point of points) {
      const key = cellKey(point.x, point.y);
      const bucket = grid.get(key) ?? new Set<string>();
      bucket.add(stroke.id);
      grid.set(key, bucket);
    }
  }
  return grid;
}

function strokeHit(
  stroke: DoodleStroke,
  x: number,
  y: number,
  radius: number,
): boolean {
  const points = unpackPoints(stroke.points);
  const hitR = radius + stroke.width / 2;
  if (points.length === 1) {
    return Math.hypot(points[0]!.x - x, points[0]!.y - y) <= hitR;
  }
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    if (pointToSegmentDistance(x, y, prev.x, prev.y, curr.x, curr.y) <= hitR) {
      return true;
    }
  }
  return false;
}

function pointInside(point: DoodlePoint, x: number, y: number, hitR: number): boolean {
  return Math.hypot(point.x - x, point.y - y) <= hitR;
}

function splitStroke(stroke: DoodleStroke, x: number, y: number, radius: number): DoodleStroke[] {
  const points = unpackPoints(stroke.points);
  const hitR = radius + stroke.width / 2;
  const fragments: DoodlePoint[][] = [];
  let current: DoodlePoint[] = [];

  for (const point of points) {
    if (pointInside(point, x, y, hitR)) {
      if (current.length > 0) {
        fragments.push(current);
        current = [];
      }
      continue;
    }
    const previous = current[current.length - 1];
    if (previous && pointToSegmentDistance(x, y, previous.x, previous.y, point.x, point.y) <= hitR) {
      fragments.push(current);
      current = [point];
      continue;
    }
    current.push(point);
  }
  if (current.length > 0) {
    fragments.push(current);
  }

  if (fragments.length === 0) {
    return [];
  }
  if (fragments.length === 1 && fragments[0]!.length === points.length) {
    return [stroke];
  }
  return fragments.map((fragment) => ({
    ...stroke,
    id: newStrokeId(),
    points: packPoints(fragment),
  }));
}

export function eraseAt(
  strokes: DoodleStroke[],
  x: number,
  y: number,
  radius: number,
): DoodleStroke[] {
  if (strokes.length === 0) {
    return strokes;
  }
  const grid = indexStrokes(strokes);
  const candidates = new Set<string>();
  for (const key of nearbyKeys(x, y, radius)) {
    const bucket = grid.get(key);
    if (bucket) {
      for (const id of bucket) candidates.add(id);
    }
  }

  if (candidates.size === 0) {
    return strokes;
  }

  const next: DoodleStroke[] = [];
  let changed = false;
  for (const stroke of strokes) {
    if (!candidates.has(stroke.id) || !strokeHit(stroke, x, y, radius)) {
      next.push(stroke);
      continue;
    }
    const parts = splitStroke(stroke, x, y, radius);
    if (parts.length === 1 && parts[0] === stroke) {
      next.push(stroke);
      continue;
    }
    changed = true;
    next.push(...parts);
  }
  return changed ? next : strokes;
}

export function eraseAlong(
  strokes: DoodleStroke[],
  samples: Array<{ x: number; y: number }>,
  radius: number,
): DoodleStroke[] {
  let current = strokes;
  for (const sample of samples) {
    current = eraseAt(current, sample.x, sample.y, radius);
  }
  return current;
}
