import type { ResolvedTheme, ThemeConfig, ThemePreference } from "@/lib/theme/config";

export type ThemePayload = {
  mode: ThemePreference;
  light: ThemeConfig | Record<string, never>;
  dark: ThemeConfig | Record<string, never>;
  resolvedLight: ResolvedTheme;
  resolvedDark: ResolvedTheme;
};
