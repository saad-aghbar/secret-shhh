import type { ResolvedTheme, ThemeTokens } from "@/lib/theme/config";

export const THEME_TOKEN_CSS: Record<keyof ThemeTokens, readonly string[]> = {
  bg: ["--shhh-bg"],
  bgSoft: ["--shhh-bg-soft"],
  surface: ["--shhh-surface"],
  surfaceRaised: ["--shhh-surface-raised", "--shhh-surface-elevated"],
  surfaceFloating: ["--shhh-surface-floating"],
  text: ["--shhh-text"],
  textSoft: ["--shhh-text-soft"],
  textMuted: ["--shhh-text-muted"],
  accent: ["--shhh-accent"],
  accentSoft: ["--shhh-accent-soft"],
  accentStrong: ["--shhh-accent-strong"],
  onAccent: ["--shhh-on-accent"],
  love: ["--shhh-love"],
  loveSoft: ["--shhh-love-soft"],
  borderSoft: ["--shhh-border-soft"],
  success: ["--shhh-success"],
  warning: ["--shhh-warning"],
  danger: ["--shhh-danger"],
  onDanger: ["--shhh-on-danger"],
  outgoing: ["--shhh-outgoing"],
  outgoingText: ["--shhh-outgoing-text"],
  incoming: ["--shhh-incoming"],
  incomingText: ["--shhh-incoming-text"],
  overlay: ["--shhh-overlay"],
  focusRing: ["--shhh-focus-ring"],
  shadowSoft: ["--shhh-shadow-soft"],
  shadowFloat: ["--shhh-shadow-float"],
  wallpaper: ["--shhh-wallpaper"],
  navSurface: ["--shhh-nav-surface"],
  navSelected: ["--shhh-nav-selected"],
  navSelectedFill: ["--shhh-nav-selected-fill"],
  navText: ["--shhh-nav-text"],
  navTextMuted: ["--shhh-nav-text-muted"],
  button: ["--shhh-button"],
  buttonStrong: ["--shhh-button-strong"],
  onButton: ["--shhh-on-button"],
  composer: ["--shhh-composer"],
  composerText: ["--shhh-composer-text"],
  composerPlaceholder: ["--shhh-composer-placeholder"],
  inputSurface: ["--shhh-input-surface"],
  sheet: ["--shhh-sheet"],
  sheetRaised: ["--shhh-sheet-raised"],
};

export function themeTokenVars(tokens: ThemeTokens): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [token, names] of Object.entries(THEME_TOKEN_CSS) as Array<
    [keyof ThemeTokens, readonly string[]]
  >) {
    const value = tokens[token];
    for (const name of names) {
      vars[name] = value;
    }
  }
  return vars;
}

export function themeCssDeclarations(tokens: ThemeTokens): string {
  return Object.entries(themeTokenVars(tokens))
    .map(([name, value]) => `${name}:${value}`)
    .join(";");
}

export function themeCssText(light: ResolvedTheme, dark: ResolvedTheme): string {
  const parts: string[] = [];
  if (!light.isDefault) {
    parts.push(`html:root{${themeCssDeclarations(light.tokens)}}`);
  }
  if (!dark.isDefault) {
    parts.push(`html:root.dark{${themeCssDeclarations(dark.tokens)}}`);
  }
  return parts.join("");
}

export const THEME_STYLE_ID = "shhh-theme";
