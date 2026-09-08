import { sniffImageMime } from "@/lib/media/validation";

/** Browser-display derivative MIME — never conflate with original source MIME. */
export type DerivativeMime = "image/webp" | "image/jpeg";

export type EncodedDerivative = {
  blob: Blob;
  mimeType: DerivativeMime;
};

export const PREPARE_PHOTO_ERROR = "Couldn't prepare this photo.";

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

async function sniffEncodedMime(blob: Blob): Promise<string | null> {
  const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  return sniffImageMime(head);
}

function blobWithMime(blob: Blob, mimeType: DerivativeMime): Blob {
  return blob.type === mimeType ? blob : new Blob([blob], { type: mimeType });
}

/**
 * Encode a canvas to a browser-display derivative.
 * WebP first; JPEG fallback. mimeType follows magic bytes when Safari lies.
 */
export async function encodeCanvasDerivative(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<EncodedDerivative> {
  try {
    const webp = await toBlob(canvas, "image/webp", quality);
    if (webp) {
      const sniffed = await sniffEncodedMime(webp);
      if (!sniffed || sniffed === "image/webp") {
        return { blob: blobWithMime(webp, "image/webp"), mimeType: "image/webp" };
      }
      if (sniffed === "image/jpeg") {
        return { blob: blobWithMime(webp, "image/jpeg"), mimeType: "image/jpeg" };
      }
    }
  } catch {
    /* try JPEG */
  }

  const jpeg = await toBlob(canvas, "image/jpeg", quality);
  if (jpeg) {
    return { blob: blobWithMime(jpeg, "image/jpeg"), mimeType: "image/jpeg" };
  }

  throw new Error(PREPARE_PHOTO_ERROR);
}

export function derivativeFilenameStem(mimeType: DerivativeMime): "webp" | "jpg" {
  return mimeType === "image/jpeg" ? "jpg" : "webp";
}
