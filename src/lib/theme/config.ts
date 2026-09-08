export const THEME_CONFIG_VERSION = 1 as const;

export const THEME_MODES = ["light", "dark"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export const THEME_PREFERENCES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const THEME_COLOR_KEYS = [
  "accent",
  "background",
  "surface",
  "outgoing",
  "incoming",
  "navSurface",
  "navSelected",
  "button",
  "composer",
  "sheet",
] as const;

export type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number];

export type HexColor = `#${string}`;

export type ThemeAuthoredColors = Record<ThemeColorKey, HexColor>;

export type ThemeColorOverrides = Partial<ThemeAuthoredColors>;

export type ThemeConfig = {
  version: typeof THEME_CONFIG_VERSION;
  preset: string;
  colors: ThemeColorOverrides;
};

export type ThemeFieldGroup = "main" | "more";

export const THEME_FIELD_META: Record<
  ThemeColorKey,
  { label: string; group: ThemeFieldGroup }
> = {
  accent: { label: "Accent", group: "main" },
  background: { label: "Background", group: "main" },
  surface: { label: "Surface", group: "main" },
  outgoing: { label: "Your messages", group: "main" },
  incoming: { label: "Their messages", group: "main" },
  navSurface: { label: "Navigation", group: "main" },
  navSelected: { label: "Selected item", group: "main" },
  button: { label: "Buttons", group: "more" },
  composer: { label: "Composer", group: "more" },
  sheet: { label: "Sheets", group: "more" },
};

export type ThemeTokens = {
  bg: HexColor;
  bgSoft: HexColor;
  surface: HexColor;
  surfaceRaised: HexColor;
  surfaceFloating: HexColor;
  text: HexColor;
  textSoft: HexColor;
  textMuted: HexColor;
  accent: HexColor;
  accentSoft: HexColor;
  accentStrong: HexColor;
  onAccent: HexColor;
  love: HexColor;
  loveSoft: HexColor;
  borderSoft: string;
  success: HexColor;
  warning: HexColor;
  danger: HexColor;
  onDanger: HexColor;
  outgoing: HexColor;
  outgoingText: HexColor;
  incoming: HexColor;
  incomingText: HexColor;
  overlay: string;
  focusRing: HexColor;
  shadowSoft: string;
  shadowFloat: string;
  wallpaper: string;
  navSurface: HexColor;
  navSelected: HexColor;
  navSelectedFill: HexColor;
  navText: HexColor;
  navTextMuted: HexColor;
  button: HexColor;
  buttonStrong: HexColor;
  onButton: HexColor;
  composer: HexColor;
  composerText: HexColor;
  composerPlaceholder: HexColor;
  inputSurface: HexColor;
  sheet: HexColor;
  sheetRaised: HexColor;
};

export type ResolvedTheme = {
  mode: ThemeMode;
  config: ThemeConfig;
  authored: ThemeAuthoredColors;
  tokens: ThemeTokens;
  isDefault: boolean;
  presetId: string;
};

export function defaultThemeConfig(): ThemeConfig {
  return {
    version: THEME_CONFIG_VERSION,
    preset: "shhh",
    colors: {},
  };
}

export function isEmptyThemeRecord(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value !== "object" || Array.isArray(value)) return true;
  return Object.keys(value as Record<string, unknown>).length === 0;
}

export function isUncustomizedTheme(config: ThemeConfig): boolean {
  return config.preset === "shhh" && Object.keys(config.colors).length === 0;
}

export function serializeThemeConfig(config: ThemeConfig): string {
  const colors: Record<string, string> = {};
  for (const key of THEME_COLOR_KEYS) {
    const value = config.colors[key];
    if (value) colors[key] = value.toLowerCase();
  }
  return JSON.stringify({ version: config.version, preset: config.preset, colors });
}

export function themeConfigsEqual(a: ThemeConfig, b: ThemeConfig): boolean {
  return serializeThemeConfig(a) === serializeThemeConfig(b);
}

export function authoredEquals(a: ThemeAuthoredColors, b: ThemeAuthoredColors): boolean {
  return THEME_COLOR_KEYS.every((key) => a[key].toLowerCase() === b[key].toLowerCase());
}
