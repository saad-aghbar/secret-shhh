"use client";

import { useRef, type PointerEvent, type TouchEvent, type WheelEvent } from "react";

import { clampZoom, moveFocal } from "@/lib/appearance/focal";

export function useWallpaperFocalGestures(
  config: { focalX: number; focalY: number; zoom: number },
  onChange: (next: { focalX: number; focalY: number; zoom: number }) => void,
) {
  const drag = useRef<{ x: number; y: number; focalX: number; focalY: number } | null>(null);
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);

  function pointerDistance(event: TouchEvent | globalThis.TouchEvent) {
    const [a, b] = [event.touches[0], event.touches[1]];
    if (!a || !b) return 0;
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (pinch.current || !event.isPrimary) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = {
        x: event.clientX,
        y: event.clientY,
        focalX: config.focalX,
        focalY: config.focalY,
      };
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      if (!drag.current || pinch.current) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const next = moveFocal(
        drag.current,
        {
          dx: (event.clientX - drag.current.x) / rect.width,
          dy: (event.clientY - drag.current.y) / rect.height,
        },
        config.zoom,
      );
      onChange({ ...next, zoom: config.zoom });
    },
    onPointerUp() {
      drag.current = null;
    },
    onPointerCancel() {
      drag.current = null;
    },
    onWheel(event: WheelEvent<HTMLElement>) {
      event.preventDefault();
      onChange({
        focalX: config.focalX,
        focalY: config.focalY,
        zoom: clampZoom(config.zoom + (event.deltaY < 0 ? 0.12 : -0.12)),
      });
    },
    onTouchStart(event: TouchEvent<HTMLElement>) {
      if (event.touches.length === 2) {
        drag.current = null;
        pinch.current = { distance: pointerDistance(event), zoom: config.zoom };
      }
    },
    onTouchMove(event: TouchEvent<HTMLElement>) {
      if (event.touches.length !== 2 || !pinch.current) return;
      event.preventDefault();
      const next = pointerDistance(event);
      if (!pinch.current.distance) return;
      onChange({
        focalX: config.focalX,
        focalY: config.focalY,
        zoom: clampZoom(pinch.current.zoom * (next / pinch.current.distance)),
      });
    },
    onTouchEnd() {
      pinch.current = null;
    },
  };
}
