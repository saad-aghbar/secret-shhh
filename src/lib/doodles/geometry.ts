import { packPoints, unpackPoints, type DoodlePoint, type DoodleStroke, type DoodleTool } from "@/lib/doodles/document";
import { MIN_POINT_DISTANCE, RDP_EPSILON } from "@/lib/doodles/limits";

export function hypot2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function pointToSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) {
    return Math.hypot(px - ax, py - ay);
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function effectiveWidth(width: number, pressure: number, tool: DoodleTool): number {
  if (tool === "marker") {
    return width;
  }
  const safe = Number.isFinite(pressure) ? Math.min(1, Math.max(0, pressure)) : 0.5;
  return width * (0.72 + 0.56 * safe);
}

export function samplePointerPressure(event: {
  pointerType?: string;
  pressure?: number;
}): number {
  if (event.pointerType === "pen" && typeof event.pressure === "number" && event.pressure > 0) {
    return Math.min(1, Math.max(0, event.pressure));
  }
  return 0.5;
}

function perpendicularDistance(point: DoodlePoint, start: DoodlePoint, end: DoodlePoint): number {
  return pointToSegmentDistance(point.x, point.y, start.x, start.y, end.x, end.y);
}

function rdp(points: DoodlePoint[], epsilon: number): DoodlePoint[] {
  if (points.length <= 2) {
    return points;
  }
  let maxDist = 0;
  let index = 0;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  for (let i = 1; i < points.length - 1; i += 1) {
    const dist = perpendicularDistance(points[i]!, first, last);
    if (dist > maxDist) {
      index = i;
      maxDist = dist;
    }
  }
  if (maxDist > epsilon) {
    const left = rdp(points.slice(0, index + 1), epsilon);
    const right = rdp(points.slice(index), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

export function simplifyPoints(points: DoodlePoint[], minDistance = MIN_POINT_DISTANCE): DoodlePoint[] {
  if (points.length <= 2) {
    return points;
  }
  const spaced: DoodlePoint[] = [points[0]!];
  for (let i = 1; i < points.length - 1; i += 1) {
    const previous = spaced[spaced.length - 1]!;
    const current = points[i]!;
    if (distance(previous.x, previous.y, current.x, current.y) >= minDistance) {
      spaced.push(current);
    }
  }
  spaced.push(points[points.length - 1]!);
  return rdp(spaced, RDP_EPSILON);
}

export function simplifyStroke(stroke: DoodleStroke): DoodleStroke {
  return {
    ...stroke,
    points: packPoints(simplifyPoints(unpackPoints(stroke.points))),
  };
}

export function appendPointIfFarEnough(
  points: DoodlePoint[],
  next: DoodlePoint,
  minDistance = MIN_POINT_DISTANCE,
): DoodlePoint[] {
  const last = points[points.length - 1];
  if (!last || distance(last.x, last.y, next.x, next.y) >= minDistance) {
    points.push(next);
  } else {
    last.x = next.x;
    last.y = next.y;
    last.pressure = next.pressure;
  }
  return points;
}

function px(point: DoodlePoint, width: number): number {
  return point.x * width;
}

function py(point: DoodlePoint, height: number): number {
  return point.y * height;
}

export function strokePathD(stroke: DoodleStroke, width: number, height: number): string {
  const points = unpackPoints(stroke.points);
  if (points.length === 0) {
    return "";
  }
  if (points.length === 1) {
    const x = px(points[0]!, width);
    const y = py(points[0]!, height);
    return `M ${x - 0.01} ${y} L ${x + 0.01} ${y}`;
  }
  if (points.length === 2) {
    return `M ${px(points[0]!, width)} ${py(points[0]!, height)} L ${px(points[1]!, width)} ${py(points[1]!, height)}`;
  }

  let d = `M ${px(points[0]!, width)} ${py(points[0]!, height)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const c1x = px(p1, width) + (px(p2, width) - px(p0, width)) / 6;
    const c1y = py(p1, height) + (py(p2, height) - py(p0, height)) / 6;
    const c2x = px(p2, width) - (px(p3, width) - px(p1, width)) / 6;
    const c2y = py(p2, height) - (py(p3, height) - py(p1, height)) / 6;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${px(p2, width)} ${py(p2, height)}`;
  }
  return d;
}

export function strokePath2D(stroke: DoodleStroke, width: number, height: number): Path2D {
  return new Path2D(strokePathD(stroke, width, height));
}

export function strokePixelWidth(
  stroke: Pick<DoodleStroke, "width" | "tool" | "points">,
  canvasWidth: number,
  canvasHeight: number,
  pressure = 0.5,
): number {
  const minSide = Math.min(canvasWidth, canvasHeight);
  return Math.max(1, effectiveWidth(stroke.width, pressure, stroke.tool) * minSide);
}

export function averagePressure(stroke: DoodleStroke): number {
  const points = unpackPoints(stroke.points);
  if (points.length === 0) return 0.5;
  let sum = 0;
  for (const point of points) sum += point.pressure;
  return sum / points.length;
}
