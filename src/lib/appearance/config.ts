import {
  DEFAULT_BLUR,
  DEFAULT_DIM,
  DEFAULT_FOCAL_X,
  DEFAULT_FOCAL_Y,
  DEFAULT_OVERLAY,
  DEFAULT_ZOOM,
  WALLPAPER_CONFIG_VERSION,
} from "@/lib/appearance/limits";

export const WALLPAPER_TYPES = ["none", "solid", "gradient", "image"] as const;
export type WallpaperType = (typeof WALLPAPER_TYPES)[number];

export const GRADIENT_DIRECTIONS = ["vertical", "diagonal", "horizontal"] as const;
export type GradientDirection = (typeof GRADIENT_DIRECTIONS)[number];

export type WallpaperGradient = {
  from: string;
  to: string;
  direction: GradientDirection;
};

export type WallpaperConfig = {
  version: typeof WALLPAPER_CONFIG_VERSION;
  type: WallpaperType;
  color?: string;
  gradient?: WallpaperGradient;
  assetId?: string;
  blur: number;
  dim: number;
  overlay: number;
  focalX: number;
  focalY: number;
  zoom: number;
};

export type AppearanceSource = "personal" | "shared" | "default";
export type AppearanceTheme = "light" | "dark";

export type AppearanceLayer = {
  type: WallpaperType;
  color?: string;
  gradient?: WallpaperGradient;
  assetId?: string;
  blur: number;
  dim: number;
  overlay: number;
  focalX: number;
  focalY: number;
  zoom: number;
};

export type AppearanceReadability = {
  overlayFloor: number;
  userOverlay: number;
  effectiveOverlay: number;
};

export type ResolvedAppearance = {
  source: AppearanceSource;
  config: WallpaperConfig;
  layer: AppearanceLayer;
  readability: AppearanceReadability;
  hash: string;
};

export function defaultWallpaperConfig(): WallpaperConfig {
  return {
    version: WALLPAPER_CONFIG_VERSION,
    type: "none",
    blur: DEFAULT_BLUR,
    dim: DEFAULT_DIM,
    overlay: DEFAULT_OVERLAY,
    focalX: DEFAULT_FOCAL_X,
    focalY: DEFAULT_FOCAL_Y,
    zoom: DEFAULT_ZOOM,
  };
}

export function isEmptyWallpaperRecord(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value !== "object" || Array.isArray(value)) return true;
  return Object.keys(value as Record<string, unknown>).length === 0;
}

export function wallpaperPaintKey(layer: AppearanceLayer, imageUrl: string | null = null): string {
  return [
    layer.type,
    layer.color ?? "",
    layer.gradient ? `${layer.gradient.from}:${layer.gradient.to}:${layer.gradient.direction}` : "",
    layer.assetId ?? "",
    imageUrl ?? "",
  ].join("|");
}

export function appearanceHash(layer: AppearanceLayer): string {
  return [
    wallpaperPaintKey(layer),
    layer.blur.toFixed(3),
    layer.dim.toFixed(3),
    layer.overlay.toFixed(3),
    layer.focalX.toFixed(3),
    layer.focalY.toFixed(3),
    layer.zoom.toFixed(3),
  ].join("|");
}
