"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

import { canvasSize, clearCanvas, paintStroke, paintStrokes } from "@/lib/doodles/paint";
import { cn } from "@/lib/utils";
import { pointerPoint, type DoodleEditorApi } from "@/features/doodles/use-doodle-editor";

type DoodleCanvasProps = {
  editor: DoodleEditorApi;
  className?: string;
};

export function DoodleCanvas({ editor, className }: DoodleCanvasProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  const rafRef = useRef(0);

  const { strokes, liveStrokeRef, beginStroke, extendStroke, finishStroke, pointerIdRef, tool } =
    editor;

  useEffect(() => {
    const frame = frameRef.current;
    const base = baseRef.current;
    const live = liveRef.current;
    if (!frame || !base || !live) return;

    function resize() {
      const host = frameRef.current;
      const baseCanvas = baseRef.current;
      const liveCanvas = liveRef.current;
      if (!host || !baseCanvas || !liveCanvas) return;
      const rect = host.getBoundingClientRect();
      sizeRef.current = { width: rect.width, height: rect.height };
      canvasSize(baseCanvas, rect.width, rect.height);
      canvasSize(liveCanvas, rect.width, rect.height);
      const ctx = baseCanvas.getContext("2d");
      if (ctx) {
        clearCanvas(ctx, rect.width, rect.height);
        paintStrokes(ctx, strokes, rect.width, rect.height);
      }
    }

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [strokes]);

  useEffect(() => {
    const live = liveRef.current;
    if (!live) return;
    const { width, height } = sizeRef.current;
    const ctx = live.getContext("2d");
    if (!ctx || !width) return;
    clearCanvas(ctx, width, height);
    if (liveStrokeRef.current) {
      paintStroke(ctx, liveStrokeRef.current, width, height);
    }
  }, [editor.drawing, liveStrokeRef, strokes]);

  function drawLive() {
    const live = liveRef.current;
    if (!live) return;
    const { width, height } = sizeRef.current;
    const ctx = live.getContext("2d");
    if (!ctx || !width) return;
    clearCanvas(ctx, width, height);
    if (liveStrokeRef.current) {
      paintStroke(ctx, liveStrokeRef.current, width, height);
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const frame = frameRef.current;
    if (!frame) return;
    pointerIdRef.current = event.pointerId;
    frame.setPointerCapture(event.pointerId);
    beginStroke(pointerPoint(event.nativeEvent, frame.getBoundingClientRect()));
    drawLive();
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== event.pointerId) return;
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const native = event.nativeEvent;
    const coalesced =
      "getCoalescedEvents" in native ? native.getCoalescedEvents() : [native];
    for (const sample of coalesced) {
      extendStroke(pointerPoint(sample, rect));
    }
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(drawLive);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== event.pointerId) return;
    pointerIdRef.current = null;
    finishStroke();
    const live = liveRef.current;
    if (live) {
      const { width, height } = sizeRef.current;
      const ctx = live.getContext("2d");
      if (ctx) clearCanvas(ctx, width, height);
    }
  }

  return (
    <div
      ref={frameRef}
      data-testid="doodle-canvas"
      role="application"
      aria-label="Doodle drawing area"
      className={cn(
        "relative h-full w-full touch-none select-none overflow-hidden",
        tool === "eraser" ? "cursor-cell" : "cursor-crosshair",
        className,
      )}
      style={{ touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <canvas ref={baseRef} className="pointer-events-none absolute inset-0" aria-hidden />
      <canvas ref={liveRef} className="pointer-events-none absolute inset-0" aria-hidden />
    </div>
  );
}
