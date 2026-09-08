import type { AppearanceLayer, AppearanceTheme, ResolvedAppearance } from "@/lib/appearance/config";
import { WALLPAPER_BLUR_PX, WALLPAPER_OVERSCALE } from "@/lib/appearance/limits";
import { wallpaperPhotoPan } from "@/lib/appearance/focal";
import { overlayFloorFor } from "@/lib/appearance/resolve";

const GRADIENT_ANGLE = {
  vertical: "180deg",
  horizontal: "90deg",
  diagonal: "135deg",
} as const;

export function gradientCss(
  from: string,
  to: string,
  direction: keyof typeof GRADIENT_ANGLE,
): string {
  return `linear-gradient(${GRADIENT_ANGLE[direction]}, ${from} 0%, ${to} 100%)`;
}

export function wallpaperPaint(layer: AppearanceLayer): string {
  if (layer.type === "solid" && layer.color) {
    return `linear-gradient(180deg, ${layer.color} 0%, ${layer.color} 100%)`;
  }
  if (layer.type === "gradient" && layer.gradient) {
    return gradientCss(layer.gradient.from, layer.gradient.to, layer.gradient.direction);
  }
  return "var(--shhh-wallpaper)";
}

export function appearanceCssVars(
  resolved: ResolvedAppearance,
  theme: AppearanceTheme = "light",
): Record<string, string> {
  const { layer, readability } = resolved;
  const floor = overlayFloorFor(layer.type, theme);
  const pan = wallpaperPhotoPan(layer.focalX, layer.focalY, layer.zoom);
  return {
    "--shhh-wallpaper-paint": wallpaperPaint(layer),
    "--shhh-wallpaper-blur": `${(layer.blur * WALLPAPER_BLUR_PX).toFixed(2)}px`,
    "--shhh-wallpaper-dim": layer.dim.toFixed(3),
    "--shhh-wallpaper-overlay-user": readability.userOverlay.toFixed(3),
    "--shhh-wallpaper-overlay-floor": floor.toFixed(3),
    "--shhh-wallpaper-overlay": Math.max(readability.userOverlay, floor).toFixed(3),
    "--shhh-wallpaper-focal-x": `${(layer.focalX * 100).toFixed(2)}%`,
    "--shhh-wallpaper-focal-y": `${(layer.focalY * 100).toFixed(2)}%`,
    "--shhh-wallpaper-focal-x-n": layer.focalX.toFixed(3),
    "--shhh-wallpaper-focal-y-n": layer.focalY.toFixed(3),
    "--shhh-wallpaper-pan-x": pan.x,
    "--shhh-wallpaper-pan-y": pan.y,
    "--shhh-wallpaper-zoom": layer.zoom.toFixed(3),
    "--shhh-wallpaper-overscale": String(WALLPAPER_OVERSCALE),
  };
}

export function appearanceCssText(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
}
