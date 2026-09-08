"use client";

import {
  CONSUMER_APPEARANCE_ERRORS,
  MAX_WALLPAPER_BYTES,
  MAX_WALLPAPER_SOURCE_BYTES,
  WALLPAPER_ENCODE_QUALITY,
  WALLPAPER_LONG_EDGE,
} from "@/lib/appearance/limits";
import { isRejectedImageSource } from "@/lib/media/source-mime";
import {
  isAllowedWallpaperUploadMime,
  type AllowedWallpaperUploadMime,
} from "@/lib/appearance/validation";
import { decodeRasterToCanvas } from "@/lib/media/decode-image";
import {
  encodeCanvasDerivative,
  PREPARE_PHOTO_ERROR,
  type EncodedDerivative,
} from "@/lib/media/encode-derivative";
import { sniffImageMime } from "@/lib/media/validation";

export type PreparedWallpaperImage = {
  blob: Blob;
  mimeType: AllowedWallpaperUploadMime;
  width: number;
  height: number;
};

export function wallpaperTargetSize(width: number, height: number, longEdge = WALLPAPER_LONG_EDGE) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    return { width: 1, height: 1, scale: 1 };
  }
  const scale = Math.min(1, longEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

async function wallpaperMimeFromEncoded(
  encoded: EncodedDerivative,
): Promise<AllowedWallpaperUploadMime> {
  const head = new Uint8Array(await encoded.blob.slice(0, 16).arrayBuffer());
  const sniffed = sniffImageMime(head);
  if (sniffed && isAllowedWallpaperUploadMime(sniffed)) return sniffed;
  if (isAllowedWallpaperUploadMime(encoded.mimeType)) return encoded.mimeType;
  throw new Error(CONSUMER_APPEARANCE_ERRORS.PREPARE_FAILED);
}

/**
 * One uncropped EXIF-normalized display image at 2048 long edge.
 * Crop/focal stay in the config — never baked into pixels.
 */
export async function prepareWallpaperImage(file: File): Promise<PreparedWallpaperImage> {
  if (file.size < 1) {
    throw new Error(CONSUMER_APPEARANCE_ERRORS.PREPARE_FAILED);
  }
  if (file.size > MAX_WALLPAPER_SOURCE_BYTES) {
    throw new Error(CONSUMER_APPEARANCE_ERRORS.TOO_LARGE);
  }
  if (isRejectedImageSource(file.type, file.name)) {
    throw new Error(CONSUMER_APPEARANCE_ERRORS.UNSUPPORTED_FORMAT);
  }

  try {
    const { canvas, width, height } = await decodeRasterToCanvas(file);
    if (!width || !height) {
      throw new Error(CONSUMER_APPEARANCE_ERRORS.PREPARE_FAILED);
    }
    const size = wallpaperTargetSize(width, height);
    const output = document.createElement("canvas");
    output.width = size.width;
    output.height = size.height;
    const context = output.getContext("2d", { alpha: false });
    if (!context) throw new Error(CONSUMER_APPEARANCE_ERRORS.PREPARE_FAILED);
    context.drawImage(canvas, 0, 0, size.width, size.height);
    const encoded = await encodeCanvasDerivative(output, WALLPAPER_ENCODE_QUALITY);
    if (encoded.blob.size > MAX_WALLPAPER_BYTES) {
      throw new Error(CONSUMER_APPEARANCE_ERRORS.TOO_LARGE);
    }
    const mimeType = await wallpaperMimeFromEncoded(encoded);
    const blob =
      encoded.blob.type === mimeType ? encoded.blob : new Blob([encoded.blob], { type: mimeType });
    return {
      blob,
      mimeType,
      width: size.width,
      height: size.height,
    };
  } catch (error) {
    if (error instanceof Error && error.message === PREPARE_PHOTO_ERROR) {
      throw new Error(CONSUMER_APPEARANCE_ERRORS.PREPARE_FAILED);
    }
    if (
      error instanceof Error &&
      (Object.values(CONSUMER_APPEARANCE_ERRORS) as string[]).includes(error.message)
    ) {
      throw error;
    }
    throw new Error(CONSUMER_APPEARANCE_ERRORS.PREPARE_FAILED);
  }
}
