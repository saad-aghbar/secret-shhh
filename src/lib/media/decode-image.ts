"use client";

import {
  canonicalizeImageSourceMime,
  isHeicImageSource,
  isRejectedImageSource,
} from "@/lib/media/source-mime";
import { PREPARE_PHOTO_ERROR } from "@/lib/media/encode-derivative";
import { sniffImageMime } from "@/lib/media/validation";

export type DecodedRaster = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
};

export async function retagImageFile(file: File): Promise<File> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const sniffed = sniffImageMime(head);
  const canon = canonicalizeImageSourceMime(sniffed ?? file.type, file.name);
  if (!canon || canon === file.type) return file;
  return new File([file], file.name || "photo", { type: canon, lastModified: file.lastModified });
}

async function convertHeicToJpeg(file: File): Promise<File> {
  const { heicTo } = await import("heic-to/csp");
  const jpeg = await heicTo({ blob: file, type: "image/jpeg", quality: 0.92 });
  if (!(jpeg instanceof Blob) || jpeg.size < 1) {
    throw new Error(PREPARE_PHOTO_ERROR);
  }
  return new File([jpeg], "photo.jpg", { type: "image/jpeg", lastModified: file.lastModified });
}

function shouldTryHeicFallback(file: File): boolean {
  if (isHeicImageSource(file.type, file.name)) return true;
  const mime = file.type.trim().toLowerCase();
  return !mime || mime === "application/octet-stream";
}

async function decodeWithNative(file: File): Promise<DecodedRaster> {
  let bitmap: ImageBitmap | null = null;
  try {
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      bitmap = await createImageBitmap(file);
    }
  } catch {
    bitmap = null;
  }

  if (bitmap) {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      bitmap.close();
      throw new Error(PREPARE_PHOTO_ERROR);
    }
    context.drawImage(bitmap, 0, 0);
    const { width, height } = bitmap;
    bitmap.close();
    return { canvas, width, height };
  }

  // HTMLImageElement fallback for PNG screenshots that reject createImageBitmap.
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(PREPARE_PHOTO_ERROR));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context || !image.naturalWidth || !image.naturalHeight) {
      throw new Error(PREPARE_PHOTO_ERROR);
    }
    context.drawImage(image, 0, 0);
    return { canvas, width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Decode any raster the browser (or HEIC fallback) can paint.
 * SVG stays rejected. Stored wallpaper/chat derivatives are still JPEG/WebP/PNG.
 */
export async function decodeRasterToCanvas(file: File): Promise<DecodedRaster> {
  const source = await retagImageFile(file);
  if (isRejectedImageSource(source.type, source.name)) {
    throw new Error(PREPARE_PHOTO_ERROR);
  }

  try {
    return await decodeWithNative(source);
  } catch (error) {
    if (!shouldTryHeicFallback(source)) {
      throw error instanceof Error ? error : new Error(PREPARE_PHOTO_ERROR);
    }
    try {
      const jpeg = await convertHeicToJpeg(source);
      return await decodeWithNative(jpeg);
    } catch {
      throw error instanceof Error ? error : new Error(PREPARE_PHOTO_ERROR);
    }
  }
}
