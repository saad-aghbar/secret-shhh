import { isAllowedImageMime, normalizeMime } from "@/lib/media/validation";

export const CAMERA_STILL_QUALITY = 0.92;
export const IMAGE_CAPTURE_TIMEOUT_MS = 1_500;

export type ImageCaptureLike = {
  takePhoto: () => Promise<Blob>;
};

export type ImageCaptureCtor = new (track: MediaStreamTrack) => ImageCaptureLike;

export function cameraPhotoFileName(mimeType: string, at = Date.now()): string {
  const ext = normalizeMime(mimeType) === "image/png" ? "png" : "jpg";
  return `shhh-${at}.${ext}`;
}

export function toCameraPhotoFile(blob: Blob, mimeType: string, at = Date.now()): File {
  const type = mimeType || blob.type || "image/jpeg";
  return new File([blob], cameraPhotoFileName(type, at), { type, lastModified: at });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function takePhotoViaImageCapture(
  takePhoto: () => Promise<Blob>,
  timeoutMs = IMAGE_CAPTURE_TIMEOUT_MS,
): Promise<Blob | null> {
  try {
    const blob = await withTimeout(takePhoto(), timeoutMs);
    const mime = normalizeMime(blob.type);
    if (blob.size > 0 && isAllowedImageMime(mime)) return blob;
    return null;
  } catch {
    return null;
  }
}

export async function encodeCanvasJpeg(
  canvas: HTMLCanvasElement,
  quality = CAMERA_STILL_QUALITY,
): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), "image/jpeg", quality);
  });
  if (!blob || blob.size < 1) {
    throw new Error("Couldn't take that photo. Try again.");
  }
  return blob;
}

export function drawVideoFrameToCanvas(
  video: Pick<HTMLVideoElement, "videoWidth" | "videoHeight">,
  canvas: HTMLCanvasElement,
) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (width < 1 || height < 1) {
    throw new Error("Couldn't take that photo. Try again.");
  }
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Couldn't take that photo. Try again.");
  }
  context.drawImage(video as CanvasImageSource, 0, 0, width, height);
}

type CaptureCameraStillOptions = {
  video: HTMLVideoElement;
  track: MediaStreamTrack;
  ImageCaptureImpl?: ImageCaptureCtor | false;
  timeoutMs?: number;
  now?: number;
  canvas?: HTMLCanvasElement;
  encodeJpeg?: (canvas: HTMLCanvasElement) => Promise<Blob>;
};

function resolveImageCaptureCtor(
  override: ImageCaptureCtor | false | undefined,
): ImageCaptureCtor | null {
  if (override === false) return null;
  if (override) return override;
  const globalCtor = (globalThis as { ImageCapture?: ImageCaptureCtor }).ImageCapture;
  return globalCtor ?? null;
}

/**
 * Prefer ImageCapture#takePhoto when it yields an allowed still (better originals).
 * Otherwise draw the live video at native track resolution — never the CSS preview size.
 */
export async function captureCameraStill(options: CaptureCameraStillOptions): Promise<File> {
  const now = options.now ?? Date.now();
  const ImageCaptureImpl = resolveImageCaptureCtor(options.ImageCaptureImpl);
  if (ImageCaptureImpl) {
    try {
      const capture = new ImageCaptureImpl(options.track);
      const still = await takePhotoViaImageCapture(
        () => capture.takePhoto(),
        options.timeoutMs ?? IMAGE_CAPTURE_TIMEOUT_MS,
      );
      if (still) {
        return toCameraPhotoFile(still, still.type || "image/jpeg", now);
      }
    } catch {
      /* canvas fallback */
    }
  }

  const canvas = options.canvas ?? document.createElement("canvas");
  drawVideoFrameToCanvas(options.video, canvas);
  const encode = options.encodeJpeg ?? ((node: HTMLCanvasElement) => encodeCanvasJpeg(node));
  const jpeg = await encode(canvas);
  return toCameraPhotoFile(jpeg, "image/jpeg", now);
}
