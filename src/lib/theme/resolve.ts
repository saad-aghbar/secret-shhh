import {
  defaultThemeConfig,
  isEmptyThemeRecord,
  isUncustomizedTheme,
  type ThemeAuthoredColors,
  type ThemeColorOverrides,
  type ThemeConfig,
  type ThemeMode,
  type ThemePreference,
  type ResolvedTheme,
} from "@/lib/theme/config";
import { deriveThemeTokens } from "@/lib/theme/derive";
import { getThemePreset, shhhPreset } from "@/lib/theme/presets";
import type { ThemePayload } from "@/lib/theme/types";
import { parseThemeConfigLoose } from "@/lib/theme/validation";

export function resolveMode(pref: ThemePreference, systemPrefersDark: boolean): ThemeMode {
  if (pref === "light") return "light";
  if (pref === "dark") return "dark";
  return systemPrefersDark ? "dark" : "light";
}

export function mergeAuthoredColors(
  mode: ThemeMode,
  config: ThemeConfig,
): { presetId: string; authored: ThemeAuthoredColors } {
  const preset = getThemePreset(config.preset, mode) ?? shhhPreset(mode);
  const user = config.colors;
  const authored: ThemeAuthoredColors = {
    ...preset.colors,
    ...user,
  };
  if (user.accent && !user.button) {
    authored.button = user.accent;
  }
  if (user.accent && !user.navSelected) {
    authored.navSelected = user.accent;
  }
  return { presetId: preset.id, authored };
}

export function resolveTheme(params: {
  stored: unknown;
  mode: ThemeMode;
}): ResolvedTheme {
  const empty = isEmptyThemeRecord(params.stored);
  const config = empty
    ? defaultThemeConfig()
    : (parseThemeConfigLoose(params.stored, params.mode) ?? defaultThemeConfig());
  const { presetId, authored } = mergeAuthoredColors(params.mode, config);
  const tokens = deriveThemeTokens(params.mode, authored);
  return {
    mode: params.mode,
    config,
    authored,
    tokens,
    isDefault: empty || isUncustomizedTheme(config),
    presetId,
  };
}

export function themeConfigFromPreset(presetId: string): ThemeConfig {
  return {
    version: 1,
    preset: presetId,
    colors: {},
  };
}

export function withThemeColor(
  config: ThemeConfig,
  key: keyof ThemeColorOverrides,
  value: ThemeColorOverrides[typeof key],
): ThemeConfig {
  return {
    ...config,
    colors: {
      ...config.colors,
      [key]: value,
    },
  };
}

export function editorThemeBaseline(payload: ThemePayload, target: ThemeMode) {
  const stored = target === "light" ? payload.light : payload.dark;
  if (isEmptyThemeRecord(stored)) return defaultThemeConfig();
  return resolveTheme({ stored, mode: target }).config;
}
