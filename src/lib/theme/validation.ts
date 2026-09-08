import { z } from "zod";

import {
  isEmptyThemeRecord,
  THEME_COLOR_KEYS,
  THEME_CONFIG_VERSION,
  type ThemeColorKey,
  type ThemeColorOverrides,
  type ThemeConfig,
  type ThemeMode,
  type ThemePreference,
} from "@/lib/theme/config";
import { isKnownThemePreset } from "@/lib/theme/presets";

export const SAFE_THEME_HEX = /^#[0-9a-fA-F]{6}$/;
export const HOSTILE_THEME_PATTERN = /[(){}<>;]|url\(|var\(|calc\(|javascript|expression/i;

export const CONSUMER_THEME_ERRORS = {
  INVALID: "Couldn't save this theme.",
};

export class ThemeValidationError extends Error {
  constructor(message = CONSUMER_THEME_ERRORS.INVALID) {
    super(message);
    this.name = "ThemeValidationError";
  }
}

const hexColor = z
  .string()
  .regex(SAFE_THEME_HEX, CONSUMER_THEME_ERRORS.INVALID)
  .refine((value) => !HOSTILE_THEME_PATTERN.test(value), {
    message: CONSUMER_THEME_ERRORS.INVALID,
  });

const colorsSchema = z
  .object({
    accent: hexColor.optional(),
    background: hexColor.optional(),
    surface: hexColor.optional(),
    outgoing: hexColor.optional(),
    incoming: hexColor.optional(),
    navSurface: hexColor.optional(),
    navSelected: hexColor.optional(),
    button: hexColor.optional(),
    composer: hexColor.optional(),
    sheet: hexColor.optional(),
  })
  .strict();

const themeConfigSchema = z
  .object({
    version: z.literal(THEME_CONFIG_VERSION),
    preset: z.string().min(1).max(32).regex(/^[a-z0-9-]+$/),
    colors: colorsSchema,
  })
  .strict();

export function normalizeThemeHex(value: string): `#${string}` {
  return value.toLowerCase() as `#${string}`;
}

export function isSafeThemeHex(value: string): boolean {
  return SAFE_THEME_HEX.test(value) && !HOSTILE_THEME_PATTERN.test(value);
}

function sanitizeColors(input: Partial<Record<ThemeColorKey, string>>): ThemeColorOverrides {
  const next: ThemeColorOverrides = {};
  for (const key of THEME_COLOR_KEYS) {
    const value = input[key];
    if (!value) continue;
    if (!isSafeThemeHex(value)) {
      throw new ThemeValidationError();
    }
    next[key] = normalizeThemeHex(value);
  }
  return next;
}

export function parseThemeConfig(input: unknown, mode: ThemeMode): ThemeConfig {
  if (isEmptyThemeRecord(input)) {
    throw new ThemeValidationError();
  }
  if (!input || typeof input !== "object") {
    throw new ThemeValidationError();
  }
  const record = input as Record<string, unknown>;
  if (record.version !== THEME_CONFIG_VERSION) {
    throw new ThemeValidationError();
  }
  if (typeof record.preset === "string" && HOSTILE_THEME_PATTERN.test(record.preset)) {
    throw new ThemeValidationError();
  }
  const parsed = themeConfigSchema.safeParse(input);
  if (!parsed.success) {
    throw new ThemeValidationError();
  }
  if (!isKnownThemePreset(parsed.data.preset, mode)) {
    throw new ThemeValidationError();
  }
  return {
    version: THEME_CONFIG_VERSION,
    preset: parsed.data.preset,
    colors: sanitizeColors(parsed.data.colors),
  };
}

export function parseThemeConfigLoose(input: unknown, mode: ThemeMode): ThemeConfig | null {
  try {
    if (isEmptyThemeRecord(input)) return null;
    return parseThemeConfig(input, mode);
  } catch {
    return null;
  }
}

export const themePreferenceSchema = z.enum(["light", "dark", "system"]);

export const saveThemeSchema = z
  .object({
    target: z.enum(["light", "dark"]),
    config: z.unknown(),
  })
  .strict();

export const patchThemeModeSchema = z
  .object({
    mode: themePreferenceSchema,
  })
  .strict();

export function parseThemePreference(value: unknown): ThemePreference {
  const parsed = themePreferenceSchema.safeParse(value);
  return parsed.success ? parsed.data : "system";
}

export function isThemeColorKey(value: string): value is ThemeColorKey {
  return (THEME_COLOR_KEYS as readonly string[]).includes(value);
}
