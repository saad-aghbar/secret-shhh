import { z } from "zod";

import { graphemeLength } from "@/lib/text/graphemes";

export const ALLOWED_STICKER_SOURCE_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export type AllowedStickerSourceMime = (typeof ALLOWED_STICKER_SOURCE_MIME)[number];

export const ALLOWED_STICKER_OUTPUT_MIME = ["image/webp", "image/png", "image/gif"] as const;
export type AllowedStickerOutputMime = (typeof ALLOWED_STICKER_OUTPUT_MIME)[number];

export const MAX_STICKER_SOURCE_BYTES = 8 * 1024 * 1024;
export const MAX_STICKER_OUTPUT_BYTES = 1.5 * 1024 * 1024;
export const STICKER_CANVAS_SIZE = 512;
export const MAX_STICKER_DIMENSION = 2048;
export const MAX_STICKER_NAME_GRAPHEMES = 32;
export const RECENT_STICKERS_CAP = 24;
export const STICKER_READ_URL_TTL_SECONDS = 10 * 60;

export const REJECTED_STICKER_MIME = ["image/svg+xml", "image/svg"] as const;

export function isAllowedStickerSourceMime(value: string): value is AllowedStickerSourceMime {
  return (ALLOWED_STICKER_SOURCE_MIME as readonly string[]).includes(value);
}

export function isAllowedStickerOutputMime(value: string): value is AllowedStickerOutputMime {
  return (ALLOWED_STICKER_OUTPUT_MIME as readonly string[]).includes(value);
}

export function normalizeStickerName(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.replace(/^\s+|\s+$/gu, "");
  return trimmed.length === 0 ? null : trimmed;
}

export function isValidStickerName(value: string | null | undefined): boolean {
  const normalized = normalizeStickerName(value);
  if (normalized === null) return true;
  return graphemeLength(normalized) <= MAX_STICKER_NAME_GRAPHEMES;
}

export const stickerNameSchema = z
  .string()
  .optional()
  .nullable()
  .transform((value) => normalizeStickerName(value))
  .refine((value) => value === null || graphemeLength(value) <= MAX_STICKER_NAME_GRAPHEMES, {
    message: "That name is a bit long.",
  });

export const stickerSectionSchema = z.enum(["recent", "favorites", "mine", "partner"]);
export type StickerSection = z.infer<typeof stickerSectionSchema>;

export const createStickerMetaSchema = z.object({
  id: z.string().uuid(),
  name: stickerNameSchema,
  animated: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((value) => value === true || value === "true"),
  width: z.coerce.number().int().positive().max(MAX_STICKER_DIMENSION),
  height: z.coerce.number().int().positive().max(MAX_STICKER_DIMENSION),
  checksum: z.string().min(8).max(128).optional(),
});

export const renameStickerSchema = z.object({
  name: stickerNameSchema,
});

export const listStickersQuerySchema = z.object({
  section: stickerSectionSchema.optional(),
});

export type CreateStickerMeta = z.infer<typeof createStickerMetaSchema>;
