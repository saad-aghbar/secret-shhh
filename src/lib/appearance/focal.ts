import { MAX_FOCAL, MAX_ZOOM, MIN_FOCAL, MIN_ZOOM } from "@/lib/appearance/limits";

export function clampFocal(value: number) {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(MAX_FOCAL, Math.max(MIN_FOCAL, value));
}

export function clampZoom(value: number) {
  if (!Number.isFinite(value)) return MIN_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

/**
 * Sticker-style pan: finger movement in viewport fractions maps 1:1 onto the
 * zoomed photo so you can scroll to any edge.
 */
export function moveFocal(
  start: { focalX: number; focalY: number },
  delta: { dx: number; dy: number },
  zoom: number,
) {
  const scale = Math.max(zoom, MIN_ZOOM);
  return {
    focalX: clampFocal(start.focalX - delta.dx / scale),
    focalY: clampFocal(start.focalY - delta.dy / scale),
  };
}

export function wallpaperPhotoPan(focalX: number, focalY: number, zoom: number) {
  const scale = clampZoom(zoom);
  return {
    x: `${((0.5 - clampFocal(focalX)) * scale * 100).toFixed(3)}%`,
    y: `${((0.5 - clampFocal(focalY)) * scale * 100).toFixed(3)}%`,
  };
}

/** Same translate+scale model the wallpaper layer uses. */
export function wallpaperPhotoTransform(focalX: number, focalY: number, zoom: number): string {
  const pan = wallpaperPhotoPan(focalX, focalY, zoom);
  return `translate(${pan.x}, ${pan.y}) scale(${clampZoom(zoom)})`;
}
