import {
  authoredEquals,
  type HexColor,
  type ThemeAuthoredColors,
  type ThemeMode,
  type ThemeTokens,
} from "@/lib/theme/config";
import {
  darken,
  ensureContrast,
  lighten,
  mix,
  readableForeground,
  withAlpha,
  WARM_DARK_IVORY,
  WARM_INK,
  WARM_IVORY,
} from "@/lib/theme/contrast";

export const SHHH_LIGHT_AUTHORED: ThemeAuthoredColors = {
  accent: "#4a756c",
  background: "#f3efe8",
  surface: "#faf7f2",
  outgoing: "#d4e8e2",
  incoming: "#fffdf9",
  navSurface: "#fffdf9",
  navSelected: "#4a756c",
  button: "#4a756c",
  composer: "#fffdf9",
  sheet: "#fffdf9",
};

export const SHHH_DARK_AUTHORED: ThemeAuthoredColors = {
  accent: "#86b5ac",
  background: "#14110f",
  surface: "#1c1916",
  outgoing: "#2a423c",
  incoming: "#26221e",
  navSurface: "#26221e",
  navSelected: "#86b5ac",
  button: "#86b5ac",
  composer: "#26221e",
  sheet: "#26221e",
};

export const SHHH_LIGHT_WALLPAPER =
  "radial-gradient(ellipse at 30% 0%, #e4efe9 0%, transparent 52%), radial-gradient(ellipse at 90% 20%, #f0e4dc 0%, transparent 40%), linear-gradient(180deg, #f3efe8 0%, #e9e3da 100%)";

export const SHHH_DARK_WALLPAPER =
  "radial-gradient(ellipse at 25% 0%, #1c2c28 0%, transparent 48%), radial-gradient(ellipse at 85% 15%, #2a221e 0%, transparent 42%), linear-gradient(180deg, #14110f 0%, #181512 100%)";

export const SHHH_LIGHT_TOKENS: ThemeTokens = {
  bg: "#f3efe8",
  bgSoft: "#ebe6de",
  surface: "#faf7f2",
  surfaceRaised: "#fffdf9",
  surfaceFloating: "#fffdf9",
  text: "#2a2622",
  textSoft: "#5c574f",
  textMuted: "#8a847a",
  accent: "#4a756c",
  accentSoft: "#d5e5e0",
  accentStrong: "#3a5f58",
  onAccent: "#ffffff",
  love: "#c48b7a",
  loveSoft: "#f0ddd6",
  borderSoft: "rgb(42 38 34 / 0.12)",
  success: "#4a7a5c",
  warning: "#b8843c",
  danger: "#b54a42",
  onDanger: "#ffffff",
  outgoing: "#d4e8e2",
  outgoingText: "#2a2622",
  incoming: "#fffdf9",
  incomingText: "#2a2622",
  overlay: "rgb(42 38 34 / 0.38)",
  focusRing: "#4a756c",
  shadowSoft: "0 1px 2px rgb(42 38 34 / 0.04), 0 10px 28px rgb(42 38 34 / 0.07)",
  shadowFloat: "0 4px 6px rgb(42 38 34 / 0.03), 0 16px 40px rgb(42 38 34 / 0.08)",
  wallpaper: SHHH_LIGHT_WALLPAPER,
  navSurface: "#fffdf9",
  navSelected: "#4a756c",
  navSelectedFill: "#d5e5e0",
  navText: "#2a2622",
  navTextMuted: "#5c574f",
  button: "#4a756c",
  buttonStrong: "#3a5f58",
  onButton: "#ffffff",
  composer: "#fffdf9",
  composerText: "#2a2622",
  composerPlaceholder: "#8a847a",
  inputSurface: "#f3efe8",
  sheet: "#fffdf9",
  sheetRaised: "#fffdf9",
};

export const SHHH_DARK_TOKENS: ThemeTokens = {
  bg: "#14110f",
  bgSoft: "#1a1714",
  surface: "#1c1916",
  surfaceRaised: "#26221e",
  surfaceFloating: "#26221e",
  text: "#f2ebe3",
  textSoft: "#b0a89e",
  textMuted: "#7d766c",
  accent: "#86b5ac",
  accentSoft: "#243530",
  accentStrong: "#9ec9c0",
  onAccent: "#ffffff",
  love: "#d4a090",
  loveSoft: "#3a2c28",
  borderSoft: "rgb(242 235 227 / 0.08)",
  success: "#7bb892",
  warning: "#d4a35c",
  danger: "#e07a72",
  onDanger: "#ffffff",
  outgoing: "#2a423c",
  outgoingText: "#f2ebe3",
  incoming: "#26221e",
  incomingText: "#f2ebe3",
  overlay: "rgb(0 0 0 / 0.55)",
  focusRing: "#86b5ac",
  shadowSoft: "0 1px 2px rgb(0 0 0 / 0.35), 0 12px 32px rgb(0 0 0 / 0.4)",
  shadowFloat: "0 4px 8px rgb(0 0 0 / 0.35), 0 18px 44px rgb(0 0 0 / 0.45)",
  wallpaper: SHHH_DARK_WALLPAPER,
  navSurface: "#26221e",
  navSelected: "#86b5ac",
  navSelectedFill: "#243530",
  navText: "#f2ebe3",
  navTextMuted: "#b0a89e",
  button: "#86b5ac",
  buttonStrong: "#9ec9c0",
  onButton: "#ffffff",
  composer: "#26221e",
  composerText: "#f2ebe3",
  composerPlaceholder: "#7d766c",
  inputSurface: "#14110f",
  sheet: "#26221e",
  sheetRaised: "#26221e",
};

function ivoryFor(mode: ThemeMode): HexColor {
  return mode === "light" ? WARM_IVORY : WARM_DARK_IVORY;
}

function defaultWallpaper(mode: ThemeMode, bg: HexColor, accent: HexColor, love: HexColor): string {
  if (mode === "light") {
    const tint1 = mix(accent, bg, 0.82);
    const tint2 = mix(love, bg, 0.72);
    const bottom = darken(bg, 0.04);
    return `radial-gradient(ellipse at 30% 0%, ${tint1} 0%, transparent 52%), radial-gradient(ellipse at 90% 20%, ${tint2} 0%, transparent 40%), linear-gradient(180deg, ${bg} 0%, ${bottom} 100%)`;
  }
  const tint1 = mix(accent, bg, 0.78);
  const tint2 = mix(love, bg, 0.7);
  const bottom = lighten(bg, 0.04);
  return `radial-gradient(ellipse at 25% 0%, ${tint1} 0%, transparent 48%), radial-gradient(ellipse at 85% 15%, ${tint2} 0%, transparent 42%), linear-gradient(180deg, ${bg} 0%, ${bottom} 100%)`;
}

function deriveAlgorithmic(mode: ThemeMode, authored: ThemeAuthoredColors): ThemeTokens {
  const isLight = mode === "light";
  const bg = authored.background;
  const surface = authored.surface;
  const accent = authored.accent;
  const ivory = ivoryFor(mode);

  const bgSoft = isLight ? mix(bg, WARM_INK, 0.035) : mix(bg, WARM_IVORY, 0.045);
  const surfaceRaised = isLight ? mix(surface, "#ffffff", 0.55) : mix(surface, WARM_IVORY, 0.14);
  const surfaceFloating = surfaceRaised;

  const ink = isLight ? WARM_INK : WARM_DARK_IVORY;
  const text = ensureContrast(ink, bg);
  const textSoft = mix(text, bg, isLight ? 0.28 : 0.32);
  const textMuted = mix(text, bg, isLight ? 0.48 : 0.5);

  const onAccent = readableForeground(accent, WARM_IVORY, WARM_INK);
  const accentSoft = isLight ? mix(accent, bg, 0.78) : mix(accent, bg, 0.82);
  const accentStrong = isLight ? darken(accent, 0.14) : lighten(accent, 0.12);

  const loveBase = isLight ? ("#c48b7a" as HexColor) : ("#d4a090" as HexColor);
  const love = mix(loveBase, accent, 0.16);
  const loveSoft = isLight ? mix(love, bg, 0.82) : mix(love, bg, 0.78);

  const success = (isLight ? "#4a7a5c" : "#7bb892") as HexColor;
  const warning = (isLight ? "#b8843c" : "#d4a35c") as HexColor;
  const danger = (isLight ? "#b54a42" : "#e07a72") as HexColor;
  const onDanger = readableForeground(danger, "#ffffff", WARM_INK);

  const outgoingText = readableForeground(authored.outgoing, ivory, WARM_INK);
  const incomingText = readableForeground(authored.incoming, ivory, WARM_INK);

  const navSurface = authored.navSurface;
  const navSelected = authored.navSelected;
  const navSelectedFill = isLight
    ? mix(navSelected, navSurface, 0.78)
    : mix(navSelected, navSurface, 0.82);
  const navText = ensureContrast(text, navSurface);
  const navTextMuted = mix(navText, navSurface, 0.42);

  const button = authored.button;
  const buttonStrong = isLight ? darken(button, 0.14) : lighten(button, 0.12);
  const onButton = readableForeground(button, WARM_IVORY, WARM_INK);

  const composer = authored.composer;
  const composerText = ensureContrast(text, composer);
  const composerPlaceholder = mix(composerText, composer, 0.48);

  const sheet = authored.sheet;
  const sheetRaised = isLight ? mix(sheet, "#ffffff", 0.35) : mix(sheet, WARM_IVORY, 0.1);

  const borderSoft = withAlpha(text, isLight ? 0.12 : 0.08);
  const overlay = isLight ? withAlpha(text, 0.38) : withAlpha("#000000", 0.55);
  const shadowInk = isLight ? text : "#000000";
  const shadowSoft = isLight
    ? `0 1px 2px ${withAlpha(shadowInk, 0.04)}, 0 10px 28px ${withAlpha(shadowInk, 0.07)}`
    : `0 1px 2px ${withAlpha(shadowInk, 0.35)}, 0 12px 32px ${withAlpha(shadowInk, 0.4)}`;
  const shadowFloat = isLight
    ? `0 4px 6px ${withAlpha(shadowInk, 0.03)}, 0 16px 40px ${withAlpha(shadowInk, 0.08)}`
    : `0 4px 8px ${withAlpha(shadowInk, 0.35)}, 0 18px 44px ${withAlpha(shadowInk, 0.45)}`;

  return {
    bg,
    bgSoft,
    surface,
    surfaceRaised,
    surfaceFloating,
    text,
    textSoft,
    textMuted,
    accent,
    accentSoft,
    accentStrong,
    onAccent,
    love,
    loveSoft,
    borderSoft,
    success,
    warning,
    danger,
    onDanger,
    outgoing: authored.outgoing,
    outgoingText,
    incoming: authored.incoming,
    incomingText,
    overlay,
    focusRing: accent,
    shadowSoft,
    shadowFloat,
    wallpaper: defaultWallpaper(mode, bg, accent, love),
    navSurface,
    navSelected,
    navSelectedFill,
    navText,
    navTextMuted,
    button,
    buttonStrong,
    onButton,
    composer,
    composerText,
    composerPlaceholder,
    inputSurface: bg,
    sheet,
    sheetRaised,
  };
}

export function deriveThemeTokens(mode: ThemeMode, authored: ThemeAuthoredColors): ThemeTokens {
  const shhh = mode === "light" ? SHHH_LIGHT_AUTHORED : SHHH_DARK_AUTHORED;
  if (authoredEquals(authored, shhh)) {
    return mode === "light" ? SHHH_LIGHT_TOKENS : SHHH_DARK_TOKENS;
  }
  return deriveAlgorithmic(mode, authored);
}
