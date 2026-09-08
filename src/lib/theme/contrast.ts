import type { HexColor } from "@/lib/theme/config";

const HEX6 = /^#[0-9a-f]{6}$/i;

export const WARM_INK = "#2a2622" as HexColor;
export const WARM_IVORY = "#fffdf9" as HexColor;
export const WARM_DARK_IVORY = "#f2ebe3" as HexColor;

export function isHexColor(value: string): value is HexColor {
  return HEX6.test(value);
}

export function parseHex(hex: string): { r: number; g: number; b: number } {
  const n = hex.slice(1).toLowerCase();
  return {
    r: Number.parseInt(n.slice(0, 2), 16),
    g: Number.parseInt(n.slice(2, 4), 16),
    b: Number.parseInt(n.slice(4, 6), 16),
  };
}

export function toHex(r: number, g: number, b: number): HexColor {
  const clamp = (value: number) => Math.min(255, Math.max(0, Math.round(value)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}` as HexColor;
}

function srgbChannel(value: number): number {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return 0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b);
}

export function contrastRatio(a: string, b: string): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function readableForeground(
  background: string,
  light: string = WARM_IVORY,
  dark: string = WARM_INK,
): HexColor {
  const lightContrast = contrastRatio(light, background);
  const darkContrast = contrastRatio(dark, background);
  return (darkContrast >= lightContrast ? dark : light).toLowerCase() as HexColor;
}

export function ensureContrast(
  foreground: string,
  background: string,
  min = 4.5,
): HexColor {
  if (contrastRatio(foreground, background) >= min) {
    return foreground.toLowerCase() as HexColor;
  }
  return readableForeground(background);
}

export function mix(a: string, b: string, amount: number): HexColor {
  const from = parseHex(a);
  const to = parseHex(b);
  const t = Math.min(1, Math.max(0, amount));
  return toHex(
    from.r + (to.r - from.r) * t,
    from.g + (to.g - from.g) * t,
    from.b + (to.b - from.b) * t,
  );
}

export function lighten(hex: string, amount: number): HexColor {
  return mix(hex, "#ffffff", amount);
}

export function darken(hex: string, amount: number): HexColor {
  return mix(hex, "#000000", amount);
}

function formatAlpha(alpha: number): string {
  const clamped = Math.min(1, Math.max(0, alpha));
  if (clamped === 0) return "0";
  if (clamped === 1) return "1";
  return String(Math.round(clamped * 1000) / 1000);
}

export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex);
  return `rgb(${r} ${g} ${b} / ${formatAlpha(alpha)})`;
}

export function isLightColor(hex: string): boolean {
  return relativeLuminance(hex) > 0.45;
}
