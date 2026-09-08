import { z } from "zod";

import { maxAudioBytes, maxImageBytes, maxVideoBytes } from "@/lib/storage";

export const ALLOWED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
] as const;

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME)[number];

export const DERIVATIVE_IMAGE_MIME = ["image/webp", "image/jpeg"] as const;
export type DerivativeImageMime = (typeof DERIVATIVE_IMAGE_MIME)[number];

/** SVG rejected — active content risk. */
export const REJECTED_IMAGE_MIME = ["image/svg+xml", "image/svg"] as const;

export const MAX_PHOTOS_PER_MESSAGE = 10;

export const ALLOWED_VIDEO_MIME = ["video/mp4", "video/quicktime", "video/webm"] as const;
export type AllowedVideoMime = (typeof ALLOWED_VIDEO_MIME)[number];

export const MAX_VIDEO_DURATION_MS = 6 * 60 * 60 * 1000;
export const MAX_CONCURRENT_VIDEO_UPLOADS = 3;
export const VIDEO_UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;
export const VIDEO_PLAYBACK_URL_TTL_SECONDS = 6 * 60 * 60;
export const VIDEO_PART_SIGN_BATCH_MAX = 8;

/**
 * Voice is recorded in Shhh, never picked from a file browser, so the allowlist is
 * exactly what a `MediaRecorder` can hand us: MP4/AAC (Safari, iPhone),
 * WebM/Opus (Chrome, Edge), Ogg/Opus (Firefox), plus raw ADTS as a safety valve.
 */
export const ALLOWED_AUDIO_MIME = ["audio/mp4", "audio/webm", "audio/ogg", "audio/aac"] as const;
export type AllowedAudioMime = (typeof ALLOWED_AUDIO_MIME)[number];

/** Hard recording cap. Reached in the UI as an auto-stop, never as a lost recording. */
export const MAX_VOICE_MESSAGE_SECONDS = 600;
export const MAX_VOICE_MESSAGE_MS = MAX_VOICE_MESSAGE_SECONDS * 1_000;
/** Below this a "recording" is a mis-tap on the mic, not a message. */
export const MIN_VOICE_MESSAGE_MS = 700;
/** Stored amplitude buckets. Bars are resampled from these to fit any width. */
export const VOICE_WAVEFORM_BUCKETS = 64;
export const VOICE_PLAYBACK_URL_TTL_SECONDS = 6 * 60 * 60;
export const VOICE_PLAYBACK_RATES = [1, 1.5, 2] as const;
export type VoicePlaybackRate = (typeof VOICE_PLAYBACK_RATES)[number];

/** Internal — mapped to consumer copy at API boundary. */
export const INTERNAL_DERIVATIVE_MIME_ERROR = "Preview files must be WebP or JPEG.";

export const mediaVariantSchema = z.enum(["original", "preview", "thumbnail"]);

export const initUploadSchema = z.object({
  clientGeneratedId: z.string().uuid(),
  clientAssetId: z.string().uuid(),
  variant: mediaVariantSchema,
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(3).max(100),
  size: z.number().int().positive(),
  width: z.number().int().positive().max(20_000).optional(),
  height: z.number().int().positive().max(20_000).optional(),
  checksum: z.string().min(8).max(128).optional(),
  /** Shared folder uuid for original+preview+thumb of one photo. */
  mediaFolderId: z.string().uuid(),
});

export const completeUploadSchema = z.object({
  checksum: z.string().min(8).max(128).optional(),
});

export const finalizePhotoMessageAssetSchema = z.object({
  clientAssetId: z.string().uuid(),
  sortOrder: z
    .number()
    .int()
    .min(0)
    .max(MAX_PHOTOS_PER_MESSAGE - 1),
  originalUploadId: z.string().uuid(),
  previewUploadId: z.string().uuid(),
  thumbnailUploadId: z.string().uuid(),
  width: z.number().int().positive().max(20_000),
  height: z.number().int().positive().max(20_000),
  mimeType: z.string().min(3).max(100),
  originalFilename: z.string().min(1).max(255),
  checksum: z.string().min(8).max(128).optional(),
});

export const finalizePhotoMessageSchema = z.object({
  clientGeneratedId: z.string().uuid(),
  caption: z.string().max(8_000).optional(),
  replyToMessageId: z.string().uuid().optional(),
  assets: z.array(finalizePhotoMessageAssetSchema).min(1).max(MAX_PHOTOS_PER_MESSAGE),
});

export const mediaUrlVariantSchema = z.enum(["thumb", "preview", "original"]);

/* Phase 5 — shared media library, albums, favorites */

export const ALBUM_TITLE_MAX = 80;
export const ALBUM_NOTE_MAX = 500;
export const ALBUM_ITEMS_BATCH_MAX = 50;
export const SHARED_MEDIA_LIMIT_MAX = 100;

export const sharedMediaFavoriteFilterSchema = z.enum(["any", "mine", "both"]);
export const sharedMediaSortSchema = z.enum(["newest", "oldest"]);

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date.")
  .optional();

const albumMediaIdsSchema = z.array(z.string().uuid()).min(1).max(ALBUM_ITEMS_BATCH_MAX);

export const createAlbumSchema = z.object({
  title: z.string().trim().min(1).max(ALBUM_TITLE_MAX),
  note: z.string().trim().max(ALBUM_NOTE_MAX).optional().nullable(),
  mediaIds: z.array(z.string().uuid()).max(ALBUM_ITEMS_BATCH_MAX).optional(),
});

export const updateAlbumSchema = z
  .object({
    title: z.string().trim().min(1).max(ALBUM_TITLE_MAX).optional(),
    note: z.string().trim().max(ALBUM_NOTE_MAX).nullable().optional(),
    coverMediaId: z.string().uuid().nullable().optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined || value.note !== undefined || value.coverMediaId !== undefined,
    { message: "Nothing to update." },
  );

export const albumItemsSchema = z.object({ mediaIds: albumMediaIdsSchema });

export const albumOrderSchema = z.object({
  mediaIds: z.array(z.string().uuid()).min(1).max(500),
});

export const setFavoriteSchema = z.object({ favorite: z.boolean() });

export const sharedMediaTypeSchema = z.enum(["all", "image", "video"]);

export const sharedMediaQuerySchema = z.object({
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(SHARED_MEDIA_LIMIT_MAX).default(60),
  sender: z.string().uuid().optional(),
  from: isoDateSchema,
  to: isoDateSchema,
  favorites: sharedMediaFavoriteFilterSchema.default("any"),
  sort: sharedMediaSortSchema.default("newest"),
  tz: z.string().min(1).max(64).optional(),
  type: sharedMediaTypeSchema.optional().default("all"),
});

export const initVideoUploadSchema = z.object({
  clientGeneratedId: z.string().uuid(),
  clientAssetId: z.string().uuid(),
  mediaFolderId: z.string().uuid(),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(3).max(100),
  size: z.number().int().positive(),
  fingerprint: z.string().min(8).max(400),
  durationMs: z.number().int().positive().max(MAX_VIDEO_DURATION_MS).optional(),
  width: z.number().int().positive().max(20_000).optional(),
  height: z.number().int().positive().max(20_000).optional(),
});

export const signVideoPartsSchema = z.object({
  partNumbers: z
    .array(z.number().int().positive().max(10_000))
    .min(1)
    .max(VIDEO_PART_SIGN_BATCH_MAX),
});

export const recordVideoPartSchema = z.object({
  etag: z.string().min(2).max(200),
  sizeBytes: z.number().int().positive(),
});

export const voiceWaveformSchema = z
  .array(z.number().int().min(0).max(100))
  .min(1)
  .max(VOICE_WAVEFORM_BUCKETS * 4);

export const initVoiceUploadSchema = z.object({
  clientGeneratedId: z.string().uuid(),
  clientAssetId: z.string().uuid(),
  mediaFolderId: z.string().uuid(),
  mimeType: z.string().min(3).max(100),
  size: z.number().int().positive(),
  durationMs: z.number().int().min(MIN_VOICE_MESSAGE_MS).max(MAX_VOICE_MESSAGE_MS),
});

export const finalizeVoiceMessageSchema = z.object({
  clientGeneratedId: z.string().uuid(),
  uploadId: z.string().uuid(),
  durationMs: z.number().int().min(MIN_VOICE_MESSAGE_MS).max(MAX_VOICE_MESSAGE_MS),
  waveform: voiceWaveformSchema,
  replyToMessageId: z.string().uuid().optional(),
});

export const finalizeVideoMessageSchema = z.object({
  caption: z.string().max(8_000).optional(),
  previewUploadId: z.string().uuid().optional(),
  thumbnailUploadId: z.string().uuid().optional(),
  durationMs: z.number().int().positive().max(MAX_VIDEO_DURATION_MS).optional(),
  width: z.number().int().positive().max(20_000).optional(),
  height: z.number().int().positive().max(20_000).optional(),
  replyToMessageId: z.string().uuid().optional(),
});

export function normalizeMime(mime: string): string {
  return mime.trim().toLowerCase().split(";")[0]?.trim() ?? "";
}

export function isAllowedImageMime(mime: string): mime is AllowedImageMime {
  const normalized = normalizeMime(mime);
  return (ALLOWED_IMAGE_MIME as readonly string[]).includes(normalized);
}

export function isDerivativeImageMime(mime: string): mime is DerivativeImageMime {
  const normalized = normalizeMime(mime);
  return (DERIVATIVE_IMAGE_MIME as readonly string[]).includes(normalized);
}

export function isRejectedImageMime(mime: string): boolean {
  const normalized = normalizeMime(mime);
  return (REJECTED_IMAGE_MIME as readonly string[]).includes(normalized);
}

export function isAllowedVideoMime(mime: string): mime is AllowedVideoMime {
  const normalized = normalizeMime(mime);
  return (ALLOWED_VIDEO_MIME as readonly string[]).includes(normalized);
}

export function isAllowedAudioMime(mime: string): mime is AllowedAudioMime {
  const normalized = normalizeMime(mime);
  return (ALLOWED_AUDIO_MIME as readonly string[]).includes(normalized);
}

export function validateAudioUploadMeta(input: {
  mimeType: string;
  size: number;
}): { ok: true } | { ok: false; message: string } {
  const mime = normalizeMime(input.mimeType);
  if (!isAllowedAudioMime(mime)) {
    return { ok: false, message: "That audio format isn't supported yet." };
  }
  if (input.size > maxAudioBytes()) {
    return { ok: false, message: "This voice message is too long to send." };
  }
  if (input.size < 1) {
    return { ok: false, message: "That file looks empty." };
  }
  return { ok: true };
}

/** Magic-byte sniff for the containers MediaRecorder produces. Returns null if unknown. */
export function sniffAudioMime(bytes: Uint8Array): AllowedAudioMime | null {
  if (bytes.length < 12) return null;
  // EBML / WebM
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return "audio/webm";
  }
  // OggS
  if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return "audio/ogg";
  }
  // ISO-BMFF (M4A shares the container with MP4 video; codec is not sniffed here).
  if (String.fromCharCode(...bytes.slice(4, 8)) === "ftyp") {
    return "audio/mp4";
  }
  // Raw ADTS AAC frame sync.
  if (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xf6) === 0xf0) {
    return "audio/aac";
  }
  return null;
}

/**
 * The only source of audio is our own recorder, so an unrecognised container is
 * read as an untested browser rather than a forgery — refusing it would brick
 * voice on an engine we never got to try. Bytes that sniff as a *picture* are a
 * different matter: no recorder emits those, so they are refused. HEIC shares
 * the `ftyp` box with M4A, which is why the image sniff has to run first.
 */
export function audioBytesLookForged(declared: string, head: Uint8Array): boolean {
  if (sniffImageMime(head)) return true;
  return !declaredAudioMimeMatchesSniff(declared, sniffAudioMime(head));
}

export function declaredAudioMimeMatchesSniff(
  declared: string,
  sniffed: AllowedAudioMime | null,
): boolean {
  if (!sniffed) return true;
  const mime = normalizeMime(declared);
  // MP4 and raw AAC both carry AAC; either declaration is acceptable for the other.
  if (sniffed === "audio/mp4" || sniffed === "audio/aac") {
    return mime === "audio/mp4" || mime === "audio/aac";
  }
  return mime === sniffed;
}

export function validateVideoUploadMeta(input: {
  mimeType: string;
  size: number;
}): { ok: true } | { ok: false; message: string } {
  const mime = normalizeMime(input.mimeType);
  if (!isAllowedVideoMime(mime)) {
    return { ok: false, message: "That video format isn't supported yet." };
  }
  const limit = maxVideoBytes();
  if (input.size > limit) {
    return { ok: false, message: "This video is too large to send." };
  }
  if (input.size < 1) {
    return { ok: false, message: "That file looks empty." };
  }
  return { ok: true };
}

export function validateOriginalUploadMeta(input: {
  mimeType: string;
  size: number;
}): { ok: true } | { ok: false; message: string } {
  const mime = normalizeMime(input.mimeType);
  if (isRejectedImageMime(mime)) {
    return { ok: false, message: "That file type isn't supported." };
  }
  if (!isAllowedImageMime(mime)) {
    return { ok: false, message: "That photo format isn't supported yet." };
  }
  const limit = maxImageBytes();
  if (input.size > limit) {
    return { ok: false, message: "This photo is too large to send." };
  }
  if (input.size < 1) {
    return { ok: false, message: "That file looks empty." };
  }
  return { ok: true };
}

export function validateDerivativeUploadMeta(input: {
  mimeType: string;
  size: number;
}): { ok: true } | { ok: false; message: string } {
  const mime = normalizeMime(input.mimeType);
  if (!isDerivativeImageMime(mime)) {
    return { ok: false, message: INTERNAL_DERIVATIVE_MIME_ERROR };
  }
  const limit = maxImageBytes();
  if (input.size > limit) {
    return { ok: false, message: "This photo is too large to send." };
  }
  if (input.size < 1) {
    return { ok: false, message: "That file looks empty." };
  }
  return { ok: true };
}

export function validateImageUploadMeta(input: {
  mimeType: string;
  size: number;
  variant: "original" | "preview" | "thumbnail";
}): { ok: true } | { ok: false; message: string } {
  if (input.variant === "original") {
    return validateOriginalUploadMeta(input);
  }
  return validateDerivativeUploadMeta(input);
}

/** Magic-byte sniff for common image types. Returns null if unknown. */
export function sniffImageMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return "image/gif";
  }
  // RIFF....WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  // HEIC/HEIF often start with ftyp....heic/heif/mif1
  const brand = String.fromCharCode(...bytes.slice(4, 8));
  if (brand === "ftyp") {
    const rest = String.fromCharCode(...bytes.slice(8, 16)).toLowerCase();
    if (rest.includes("heic") || rest.includes("heif") || rest.includes("mif1")) {
      return "image/heic";
    }
  }
  return null;
}

/** Magic-byte sniff for common video containers. Returns null if unknown. */
export function sniffVideoMime(bytes: Uint8Array): AllowedVideoMime | null {
  if (bytes.length < 12) return null;
  // EBML / WebM
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return "video/webm";
  }
  const brand = String.fromCharCode(...bytes.slice(4, 8));
  if (brand === "ftyp") {
    const rest = String.fromCharCode(...bytes.slice(8, 16)).toLowerCase();
    if (rest.includes("qt") || rest.startsWith("qt  ")) {
      return "video/quicktime";
    }
    return "video/mp4";
  }
  return null;
}

export function declaredMimeMatchesSniff(
  declared: string,
  sniffed: AllowedVideoMime | null,
): boolean {
  if (!sniffed) return true;
  const mime = normalizeMime(declared);
  if (sniffed === "video/webm") return mime === "video/webm";
  // MP4 and Quicktime share an ISO-BMFF container; either declared type is fine.
  return mime === "video/mp4" || mime === "video/quicktime";
}

export async function resolveOriginalVideoMime(file: File): Promise<string> {
  const declared = normalizeMime(file.type);
  if (isAllowedVideoMime(declared)) return declared;
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const sniffed = sniffVideoMime(head);
  if (sniffed) return sniffed;
  const name = file.name.toLowerCase();
  if (name.endsWith(".mov")) return "video/quicktime";
  if (name.endsWith(".webm")) return "video/webm";
  if (name.endsWith(".mp4") || name.endsWith(".m4v")) return "video/mp4";
  return declared || "application/octet-stream";
}

export function sanitizeOriginalFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "photo";
  return base.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 180) || "photo";
}

/** Resolve original upload MIME from File metadata + magic bytes. */
export async function resolveOriginalFileMime(file: File): Promise<string> {
  const declared = normalizeMime(file.type);
  if (isAllowedImageMime(declared)) return declared;
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const sniffed = sniffImageMime(head);
  if (sniffed && isAllowedImageMime(sniffed)) return sniffed;
  return declared || "application/octet-stream";
}
