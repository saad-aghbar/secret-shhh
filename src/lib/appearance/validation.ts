import { z } from "zod";

import {
  defaultWallpaperConfig,
  isEmptyWallpaperRecord,
  type WallpaperConfig,
} from "@/lib/appearance/config";
import {
  CONSUMER_APPEARANCE_ERRORS,
  MAX_BLUR,
  MAX_DIM,
  MAX_FOCAL,
  MAX_OVERLAY,
  MAX_WALLPAPER_BYTES,
  MAX_WALLPAPER_EDGE,
  MAX_ZOOM,
  MIN_BLUR,
  MIN_DIM,
  MIN_FOCAL,
  MIN_OVERLAY,
  MIN_ZOOM,
  WALLPAPER_CONFIG_VERSION,
} from "@/lib/appearance/limits";

export const SAFE_HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
export const WALLPAPER_ASSET_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const ALLOWED_WALLPAPER_UPLOAD_MIME = [
  "image/webp",
  "image/jpeg",
  "image/png",
  "image/gif",
] as const;
export type AllowedWallpaperUploadMime = (typeof ALLOWED_WALLPAPER_UPLOAD_MIME)[number];

export class AppearanceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppearanceValidationError";
  }
}

const finiteNumber = z
  .number()
  .refine((value) => Number.isFinite(value), { message: CONSUMER_APPEARANCE_ERRORS.INVALID });

const hexColor = z
  .string()
  .regex(SAFE_HEX_COLOR, CONSUMER_APPEARANCE_ERRORS.INVALID)
  .refine((value) => !/[(){}<>]|url|javascript|expression/i.test(value), {
    message: CONSUMER_APPEARANCE_ERRORS.INVALID,
  });

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function isSafeHexColor(value: string): boolean {
  return SAFE_HEX_COLOR.test(value);
}

export function normalizeHexColor(value: string): string {
  return value.toLowerCase();
}

export function clampUnit(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return clamp(value, min, max);
}

const gradientSchema = z
  .object({
    from: hexColor,
    to: hexColor,
    direction: z.enum(["vertical", "diagonal", "horizontal"]),
  })
  .strict();

const wallpaperConfigSchema = z
  .object({
    version: z.literal(WALLPAPER_CONFIG_VERSION),
    type: z.enum(["none", "solid", "gradient", "image"]),
    color: hexColor.optional(),
    gradient: gradientSchema.optional(),
    assetId: z.uuid().optional(),
    blur: finiteNumber,
    dim: finiteNumber,
    overlay: finiteNumber,
    focalX: finiteNumber,
    focalY: finiteNumber,
    zoom: finiteNumber,
  })
  .strict();

export function sanitizeWallpaperConfig(input: WallpaperConfig): WallpaperConfig {
  const next = defaultWallpaperConfig();
  next.type = input.type;
  next.blur = clampUnit(input.blur, MIN_BLUR, MAX_BLUR, 0);
  next.dim = clampUnit(input.dim, MIN_DIM, MAX_DIM, 0);
  next.overlay = clampUnit(input.overlay, MIN_OVERLAY, MAX_OVERLAY, 0);
  next.focalX = clampUnit(input.focalX, MIN_FOCAL, MAX_FOCAL, 0.5);
  next.focalY = clampUnit(input.focalY, MIN_FOCAL, MAX_FOCAL, 0.5);
  next.zoom = clampUnit(input.zoom, MIN_ZOOM, MAX_ZOOM, 1);

  if (input.type === "solid") {
    if (!input.color || !isSafeHexColor(input.color)) {
      throw new AppearanceValidationError(CONSUMER_APPEARANCE_ERRORS.INVALID);
    }
    next.color = normalizeHexColor(input.color);
  }
  if (input.type === "gradient") {
    if (!input.gradient) {
      throw new AppearanceValidationError(CONSUMER_APPEARANCE_ERRORS.INVALID);
    }
    next.gradient = {
      from: normalizeHexColor(input.gradient.from),
      to: normalizeHexColor(input.gradient.to),
      direction: input.gradient.direction,
    };
  }
  if (input.type === "image") {
    if (!input.assetId || !WALLPAPER_ASSET_ID.test(input.assetId)) {
      throw new AppearanceValidationError(CONSUMER_APPEARANCE_ERRORS.INVALID);
    }
    next.assetId = input.assetId;
  }
  return next;
}

export function parseWallpaperConfig(input: unknown): WallpaperConfig {
  if (isEmptyWallpaperRecord(input)) {
    throw new AppearanceValidationError(CONSUMER_APPEARANCE_ERRORS.INVALID);
  }
  if (!input || typeof input !== "object") {
    throw new AppearanceValidationError(CONSUMER_APPEARANCE_ERRORS.INVALID);
  }
  const record = input as Record<string, unknown>;
  if (record.version !== WALLPAPER_CONFIG_VERSION) {
    throw new AppearanceValidationError(CONSUMER_APPEARANCE_ERRORS.INVALID);
  }
  if (typeof record.color === "string" && !isSafeHexColor(record.color)) {
    throw new AppearanceValidationError(CONSUMER_APPEARANCE_ERRORS.INVALID);
  }
  const parsed = wallpaperConfigSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppearanceValidationError(CONSUMER_APPEARANCE_ERRORS.INVALID);
  }
  return sanitizeWallpaperConfig(parsed.data);
}

export function parseWallpaperConfigLoose(input: unknown): WallpaperConfig | null {
  try {
    if (isEmptyWallpaperRecord(input)) return null;
    return parseWallpaperConfig(input);
  } catch {
    return null;
  }
}

/** Personal override is present only when the stored object is a valid config. */
export function parsePersonalOverride(input: unknown): WallpaperConfig | null {
  if (isEmptyWallpaperRecord(input)) return null;
  return parseWallpaperConfigLoose(input);
}

export const saveAppearanceSchema = z.unknown();

export const initWallpaperUploadSchema = z.object({
  mimeType: z.string().min(3).max(100),
  size: z.number().int().positive().max(MAX_WALLPAPER_BYTES),
  width: z.number().int().positive().max(MAX_WALLPAPER_EDGE),
  height: z.number().int().positive().max(MAX_WALLPAPER_EDGE),
  checksum: z.string().min(8).max(128).optional(),
});

export const completeWallpaperUploadSchema = z.object({
  checksum: z.string().min(8).max(128).optional(),
});

export function normalizeWallpaperMime(mime: string): string {
  return mime.trim().toLowerCase().split(";")[0]?.trim() ?? "";
}

export function isAllowedWallpaperUploadMime(mime: string): mime is AllowedWallpaperUploadMime {
  return (ALLOWED_WALLPAPER_UPLOAD_MIME as readonly string[]).includes(normalizeWallpaperMime(mime));
}

export function validateWallpaperUploadMeta(input: {
  mimeType: string;
  size: number;
  width: number;
  height: number;
}): { ok: true; mimeType: AllowedWallpaperUploadMime } | { ok: false; message: string } {
  const mime = normalizeWallpaperMime(input.mimeType);
  if (!isAllowedWallpaperUploadMime(mime)) {
    return { ok: false, message: CONSUMER_APPEARANCE_ERRORS.UNSUPPORTED_FORMAT };
  }
  if (input.size < 1 || input.size > MAX_WALLPAPER_BYTES) {
    return { ok: false, message: CONSUMER_APPEARANCE_ERRORS.TOO_LARGE };
  }
  if (
    !Number.isFinite(input.width) ||
    !Number.isFinite(input.height) ||
    input.width < 1 ||
    input.height < 1 ||
    input.width > MAX_WALLPAPER_EDGE ||
    input.height > MAX_WALLPAPER_EDGE
  ) {
    return { ok: false, message: CONSUMER_APPEARANCE_ERRORS.PREPARE_FAILED };
  }
  return { ok: true, mimeType: mime };
}
