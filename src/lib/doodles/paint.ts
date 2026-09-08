import { averagePressure, strokePath2D, strokePixelWidth } from "@/lib/doodles/geometry";
import type { DoodleStroke } from "@/lib/doodles/document";

export function paintStroke(
  ctx: CanvasRenderingContext2D,
  stroke: DoodleStroke,
  width: number,
  height: number,
) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = stroke.color;
  ctx.globalAlpha = stroke.opacity;
  ctx.globalCompositeOperation = stroke.tool === "marker" ? "multiply" : "source-over";
  ctx.lineWidth = strokePixelWidth(stroke, width, height, averagePressure(stroke));
  ctx.stroke(strokePath2D(stroke, width, height));
  ctx.restore();
}

export function paintStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: DoodleStroke[],
  width: number,
  height: number,
) {
  for (const stroke of strokes) {
    paintStroke(ctx, stroke, width, height);
  }
}

export function clearCanvas(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.clearRect(0, 0, width, height);
}

export function canvasSize(node: HTMLCanvasElement, cssWidth: number, cssHeight: number) {
  const dpr = typeof window === "undefined" ? 1 : Math.max(1, window.devicePixelRatio || 1);
  node.width = Math.max(1, Math.round(cssWidth * dpr));
  node.height = Math.max(1, Math.round(cssHeight * dpr));
  node.style.width = `${cssWidth}px`;
  node.style.height = `${cssHeight}px`;
  const ctx = node.getContext("2d");
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  return { ctx, dpr };
}
