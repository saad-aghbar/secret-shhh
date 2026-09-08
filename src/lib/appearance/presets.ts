import { defaultWallpaperConfig, type WallpaperConfig } from "@/lib/appearance/config";

export type ColorPreset = {
  id: string;
  label: string;
  value: string;
};

export type GradientPreset = {
  id: string;
  label: string;
  from: string;
  to: string;
  direction: "vertical" | "diagonal" | "horizontal";
};

export const COLOR_PRESETS: readonly ColorPreset[] = [
  { id: "sage", label: "Sage", value: "#4a756c" },
  { id: "clay", label: "Clay", value: "#c48b7a" },
  { id: "blush", label: "Blush", value: "#d9899c" },
  { id: "sky", label: "Sky", value: "#6b8fad" },
  { id: "lavender", label: "Lavender", value: "#9b8ab8" },
  { id: "sun", label: "Sun", value: "#e4c15a" },
  { id: "ink", label: "Ink", value: "#2a2622" },
  { id: "cream", label: "Cream", value: "#f3efe8" },
] as const;

export const GRADIENT_PRESETS: readonly GradientPreset[] = [
  { id: "sage-mist", label: "Sage mist", from: "#4a756c", to: "#e4efe9", direction: "vertical" },
  { id: "sunset", label: "Sunset", from: "#c48b7a", to: "#d9899c", direction: "diagonal" },
  { id: "dusk", label: "Dusk", from: "#2a2622", to: "#1c2c28", direction: "vertical" },
  { id: "warm-cream", label: "Warm cream", from: "#f3efe8", to: "#e4c15a", direction: "horizontal" },
] as const;

export const PRESET_ROW_COLOR_IDS = ["sage", "clay", "blush", "cream"] as const;
export const PRESET_ROW_GRADIENT_IDS = ["sage-mist", "sunset"] as const;

export function configFromColor(color: string, base?: WallpaperConfig): WallpaperConfig {
  return {
    ...(base ?? defaultWallpaperConfig()),
    type: "solid",
    color,
    gradient: undefined,
    assetId: undefined,
  };
}

export function configFromGradient(
  preset: Pick<GradientPreset, "from" | "to" | "direction">,
  base?: WallpaperConfig,
): WallpaperConfig {
  return {
    ...(base ?? defaultWallpaperConfig()),
    type: "gradient",
    color: undefined,
    assetId: undefined,
    gradient: { from: preset.from, to: preset.to, direction: preset.direction },
  };
}

export function configFromDefault(base?: WallpaperConfig): WallpaperConfig {
  return {
    ...(base ?? defaultWallpaperConfig()),
    type: "none",
    color: undefined,
    gradient: undefined,
    assetId: undefined,
  };
}

export function matchingColorPresetId(config: WallpaperConfig): string | null {
  if (config.type !== "solid" || !config.color) return null;
  return COLOR_PRESETS.find((preset) => preset.value === config.color)?.id ?? null;
}

export function matchingGradientPresetId(config: WallpaperConfig): string | null {
  if (config.type !== "gradient" || !config.gradient) return null;
  return (
    GRADIENT_PRESETS.find(
      (preset) =>
        preset.from === config.gradient?.from &&
        preset.to === config.gradient.to &&
        preset.direction === config.gradient.direction,
    )?.id ?? null
  );
}
