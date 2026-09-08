"use client";

import { decodeRasterToCanvas } from "@/lib/media/decode-image";
import {
  encodeCanvasDerivative,
  PREPARE_PHOTO_ERROR,
  type EncodedDerivative,
} from "@/lib/media/encode-derivative";

export type { EncodedDerivative };

export type ImageDerivatives = {
  width: number;
  height: number;
  preview: EncodedDerivative;
  thumb: EncodedDerivative;
  originalFile: File;
};

const PREVIEW_LONG_EDGE = 1600;
const THUMB_LONG_EDGE = 384;

function targetSize(width: number, height: number, longEdge: number) {
  const scale = Math.min(1, longEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function encodeFromCanvas(
  source: HTMLCanvasElement,
  sourceWidth: number,
  sourceHeight: number,
  longEdge: number,
  quality: number,
): Promise<EncodedDerivative> {
  const size = targetSize(sourceWidth, sourceHeight, longEdge);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error(PREPARE_PHOTO_ERROR);
  context.drawImage(source, 0, 0, size.width, size.height);
  return encodeCanvasDerivative(canvas, quality);
}

/**
 * Decodes then redraws the image, which removes EXIF and other source metadata
 * from the generated preview and thumbnail.
 */
export async function createImageDerivatives(file: File): Promise<ImageDerivatives> {
  try {
    const { canvas, width, height } = await decodeRasterToCanvas(file);
    if (!width || !height) {
      throw new Error(PREPARE_PHOTO_ERROR);
    }
    const preview = await encodeFromCanvas(canvas, width, height, PREVIEW_LONG_EDGE, 0.84);
    const thumb = await encodeFromCanvas(canvas, width, height, THUMB_LONG_EDGE, 0.76);
    return {
      width,
      height,
      preview,
      thumb,
      originalFile: file,
    };
  } catch (error) {
    if (error instanceof Error && error.message === PREPARE_PHOTO_ERROR) {
      throw error;
    }
    throw new Error(PREPARE_PHOTO_ERROR);
  }
}

/** Keeps memory use predictable on mobile by processing one image at a time. */
export async function processImagesOneAtATime<T>(
  files: readonly File[],
  process: (file: File, index: number) => Promise<T>,
): Promise<T[]> {
  const results: T[] = [];
  for (let index = 0; index < files.length; index += 1) {
    results.push(await process(files[index]!, index));
  }
  return results;
}
