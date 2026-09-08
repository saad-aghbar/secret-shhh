"use client";

import { encodeCanvasDerivative, type EncodedDerivative } from "@/lib/media/encode-derivative";
import { posterSeekSeconds } from "@/lib/media/video-poster-seek";

const PREVIEW_LONG_EDGE = 1600;
const THUMB_LONG_EDGE = 384;
const POSTER_TIMEOUT_MS = 8_000;

export type VideoPosterResult = {
  width: number;
  height: number;
  durationMs: number;
  preview: EncodedDerivative | null;
  thumb: EncodedDerivative | null;
};

function targetSize(width: number, height: number, longEdge: number) {
  const scale = Math.min(1, longEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(label)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
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
  if (!context) throw new Error("Couldn't prepare this video.");
  context.drawImage(source, 0, 0, size.width, size.height);
  return encodeCanvasDerivative(canvas, quality);
}

/**
 * Seek to an early non-black frame, encode poster preview + thumb.
 * Never throws for codec failure — posters stay null so the original can still send.
 */
export async function createVideoPoster(file: File): Promise<VideoPosterResult> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.src = url;

  try {
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("decode"));
      }),
      POSTER_TIMEOUT_MS,
      "decode",
    );

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await withTimeout(
        new Promise<void>((resolve, reject) => {
          video.onloadeddata = () => resolve();
          video.onerror = () => reject(new Error("decode"));
        }),
        POSTER_TIMEOUT_MS,
        "decode",
      );
    }

    const seekTo = posterSeekSeconds(video.duration);
    const alreadyHasFrame =
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      Math.abs(video.currentTime - seekTo) < 0.05;
    if (!alreadyHasFrame) {
      await withTimeout(
        new Promise<void>((resolve, reject) => {
          video.onseeked = () => resolve();
          video.onerror = () => reject(new Error("seek"));
          try {
            video.currentTime = seekTo;
          } catch {
            reject(new Error("seek"));
          }
        }),
        POSTER_TIMEOUT_MS,
        "seek",
      );
    }

    const durationMs = Number.isFinite(video.duration)
      ? Math.max(1, Math.round(video.duration * 1000))
      : 0;
    const width = video.videoWidth || 0;
    const height = video.videoHeight || 0;
    if (!width || !height) {
      return { width, height, durationMs, preview: null, thumb: null };
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      return { width, height, durationMs, preview: null, thumb: null };
    }
    context.drawImage(video, 0, 0, width, height);
    const preview = await encodeFromCanvas(canvas, width, height, PREVIEW_LONG_EDGE, 0.84);
    const thumb = await encodeFromCanvas(canvas, width, height, THUMB_LONG_EDGE, 0.76);
    return { width, height, durationMs, preview, thumb };
  } catch {
    return {
      width: 0,
      height: 0,
      durationMs: 0,
      preview: null,
      thumb: null,
    };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
