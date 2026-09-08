import type { HexColor, ThemeAuthoredColors, ThemeMode } from "@/lib/theme/config";
import { SHHH_DARK_AUTHORED, SHHH_LIGHT_AUTHORED } from "@/lib/theme/derive";

export type ThemePreset = {
  id: string;
  label: string;
  mode: ThemeMode;
  colors: ThemeAuthoredColors;
};

function colors(input: ThemeAuthoredColors): ThemeAuthoredColors {
  return input;
}

export const LIGHT_THEME_PRESETS: readonly ThemePreset[] = [
  { id: "shhh", label: "Shhh", mode: "light", colors: SHHH_LIGHT_AUTHORED },
  {
    id: "sage",
    label: "Sage",
    mode: "light",
    colors: colors({
      accent: "#3f6f5e",
      background: "#eef3ee",
      surface: "#f6faf6",
      outgoing: "#cfe3d6",
      incoming: "#f8fcf8",
      navSurface: "#f6faf6",
      navSelected: "#3f6f5e",
      button: "#3f6f5e",
      composer: "#f6faf6",
      sheet: "#f8fcf8",
    }),
  },
  {
    id: "blush",
    label: "Blush",
    mode: "light",
    colors: colors({
      accent: "#b56d5c",
      background: "#f6efe8",
      surface: "#fbf6f2",
      outgoing: "#ead4cc",
      incoming: "#fffdf9",
      navSurface: "#fffdf9",
      navSelected: "#b56d5c",
      button: "#b56d5c",
      composer: "#fffdf9",
      sheet: "#fffdf9",
    }),
  },
  {
    id: "lavender",
    label: "Lavender",
    mode: "light",
    colors: colors({
      accent: "#6f5f94",
      background: "#f3eef6",
      surface: "#f8f4fb",
      outgoing: "#e4daf0",
      incoming: "#fffdfb",
      navSurface: "#f8f4fb",
      navSelected: "#6f5f94",
      button: "#6f5f94",
      composer: "#f8f4fb",
      sheet: "#fffdfb",
    }),
  },
  {
    id: "ocean",
    label: "Ocean",
    mode: "light",
    colors: colors({
      accent: "#3d6d7e",
      background: "#eef3f5",
      surface: "#f5f9fb",
      outgoing: "#d2e4ea",
      incoming: "#fffefb",
      navSurface: "#f5f9fb",
      navSelected: "#3d6d7e",
      button: "#3d6d7e",
      composer: "#f5f9fb",
      sheet: "#fffefb",
    }),
  },
  {
    id: "peach",
    label: "Peach",
    mode: "light",
    colors: colors({
      accent: "#b56a4a",
      background: "#f7efe6",
      surface: "#fcf6ef",
      outgoing: "#f3dcc8",
      incoming: "#fffdf9",
      navSurface: "#fcf6ef",
      navSelected: "#b56a4a",
      button: "#b56a4a",
      composer: "#fcf6ef",
      sheet: "#fffdf9",
    }),
  },
];

export const DARK_THEME_PRESETS: readonly ThemePreset[] = [
  { id: "shhh", label: "Shhh", mode: "dark", colors: SHHH_DARK_AUTHORED },
  {
    id: "midnight",
    label: "Midnight",
    mode: "dark",
    colors: colors({
      accent: "#9eb0d6",
      background: "#12141a",
      surface: "#1a1d26",
      outgoing: "#24304a",
      incoming: "#22262f",
      navSurface: "#1e222c",
      navSelected: "#9eb0d6",
      button: "#9eb0d6",
      composer: "#1e222c",
      sheet: "#1e222c",
    }),
  },
  {
    id: "rose",
    label: "Rose",
    mode: "dark",
    colors: colors({
      accent: "#e0b4a6",
      background: "#161210",
      surface: "#1e1916",
      outgoing: "#3a2c28",
      incoming: "#26211e",
      navSurface: "#26211e",
      navSelected: "#e0b4a6",
      button: "#e0b4a6",
      composer: "#26211e",
      sheet: "#26211e",
    }),
  },
  {
    id: "deep-sage",
    label: "Deep Sage",
    mode: "dark",
    colors: colors({
      accent: "#8ec9a3",
      background: "#121412",
      surface: "#181c18",
      outgoing: "#243528",
      incoming: "#222622",
      navSurface: "#1c221c",
      navSelected: "#8ec9a3",
      button: "#8ec9a3",
      composer: "#1c221c",
      sheet: "#1c221c",
    }),
  },
  {
    id: "plum",
    label: "Plum",
    mode: "dark",
    colors: colors({
      accent: "#c7b2e0",
      background: "#141018",
      surface: "#1c1822",
      outgoing: "#2e2440",
      incoming: "#26222c",
      navSurface: "#221e28",
      navSelected: "#c7b2e0",
      button: "#c7b2e0",
      composer: "#221e28",
      sheet: "#221e28",
    }),
  },
  {
    id: "ocean",
    label: "Ocean",
    mode: "dark",
    colors: colors({
      accent: "#8fbecd",
      background: "#101418",
      surface: "#161c22",
      outgoing: "#1e3340",
      incoming: "#1e242a",
      navSurface: "#1a2228",
      navSelected: "#8fbecd",
      button: "#8fbecd",
      composer: "#1a2228",
      sheet: "#1a2228",
    }),
  },
];

export function themePresetsFor(mode: ThemeMode): readonly ThemePreset[] {
  return mode === "light" ? LIGHT_THEME_PRESETS : DARK_THEME_PRESETS;
}

export function getThemePreset(id: string, mode: ThemeMode): ThemePreset | null {
  return themePresetsFor(mode).find((preset) => preset.id === id) ?? null;
}

export function isKnownThemePreset(id: string, mode: ThemeMode): boolean {
  return themePresetsFor(mode).some((preset) => preset.id === id);
}

export function shhhPreset(mode: ThemeMode): ThemePreset {
  return themePresetsFor(mode)[0]!;
}

export type CuratedSwatch = { id: string; label: string; value: HexColor };

export const CURATED_THEME_SWATCHES: readonly CuratedSwatch[] = [
  { id: "sage", label: "Sage", value: "#4a756c" },
  { id: "moss", label: "Moss", value: "#3f6f5e" },
  { id: "blush", label: "Blush", value: "#c48b7a" },
  { id: "rose", label: "Rose", value: "#d9899c" },
  { id: "lavender", label: "Lavender", value: "#9b8ab8" },
  { id: "plum", label: "Plum", value: "#6f5f94" },
  { id: "ocean", label: "Ocean", value: "#4a7a8c" },
  { id: "sky", label: "Sky", value: "#6b8fad" },
  { id: "peach", label: "Peach", value: "#c9846a" },
  { id: "honey", label: "Honey", value: "#c9a14a" },
  { id: "cream", label: "Cream", value: "#f3efe8" },
  { id: "ivory", label: "Ivory", value: "#fffdf9" },
  { id: "linen", label: "Linen", value: "#faf7f2" },
  { id: "charcoal", label: "Charcoal", value: "#2a2622" },
  { id: "ink", label: "Ink", value: "#1c1916" },
  { id: "midnight", label: "Midnight", value: "#14110f" },
];
