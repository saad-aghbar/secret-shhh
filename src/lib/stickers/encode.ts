import { STICKER_CANVAS_SIZE } from "@/lib/stickers/validation";

export type StickerEncodeTransform = {
  /** Scale relative to covering the 512 square with the source. */
  scale: number;
  /** Clockwise rotation in degrees. */
  rotationDeg: number;
  /** Pan in canvas pixels from center. */
  panX: number;
  panY: number;
};

export type EncodedSticker = {
  blob: Blob;
  mimeType: "image/webp" | "image/png";
  width: number;
  height: number;
};

const DEFAULT_TRANSFORM: StickerEncodeTransform = {
  scale: 1,
  rotationDeg: 0,
  panX: 0,
  panY: 0,
};

function coverScale(srcW: number, srcH: number, dest: number) {
  return dest / Math.min(srcW, srcH);
}

/**
 * Draw a source onto a 512×512 alpha canvas, then encode WebP-with-alpha
 * (PNG fallback when the browser cannot produce WebP).
 */
export async function encodeStickerCanvas(
  source: CanvasImageSource,
  transform: Partial<StickerEncodeTransform> = {},
): Promise<EncodedSticker> {
  const { scale, rotationDeg, panX, panY } = { ...DEFAULT_TRANSFORM, ...transform };
  const canvas = document.createElement("canvas");
  canvas.width = STICKER_CANVAS_SIZE;
  canvas.height = STICKER_CANVAS_SIZE;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) {
    throw new Error("Couldn't prepare that sticker.");
  }
  ctx.clearRect(0, 0, STICKER_CANVAS_SIZE, STICKER_CANVAS_SIZE);

  const srcW =
    "naturalWidth" in source && typeof source.naturalWidth === "number" && source.naturalWidth > 0
      ? source.naturalWidth
      : "width" in source && typeof source.width === "number"
        ? source.width
        : STICKER_CANVAS_SIZE;
  const srcH =
    "naturalHeight" in source && typeof source.naturalHeight === "number" && source.naturalHeight > 0
      ? source.naturalHeight
      : "height" in source && typeof source.height === "number"
        ? source.height
        : STICKER_CANVAS_SIZE;

  const fit = coverScale(srcW, srcH, STICKER_CANVAS_SIZE) * scale;
  const drawW = srcW * fit;
  const drawH = srcH * fit;

  ctx.save();
  ctx.translate(STICKER_CANVAS_SIZE / 2 + panX, STICKER_CANVAS_SIZE / 2 + panY);
  ctx.rotate((rotationDeg * Math.PI) / 180);
  ctx.drawImage(source, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  const encoded = await canvasToStickerBlob(canvas);
  canvas.width = 0;
  canvas.height = 0;
  return encoded;
}

export async function canvasToStickerBlob(canvas: HTMLCanvasElement): Promise<EncodedSticker> {
  const webp = await blobFromCanvas(canvas, "image/webp", 0.92);
  if (webp && webp.size > 0 && (await blobLooksLikeWebp(webp))) {
    return { blob: webp, mimeType: "image/webp", width: canvas.width, height: canvas.height };
  }
  const png = await blobFromCanvas(canvas, "image/png");
  if (!png || png.size === 0) {
    throw new Error("Couldn't save that sticker.");
  }
  return { blob: png, mimeType: "image/png", width: canvas.width, height: canvas.height };
}

function blobFromCanvas(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

async function blobLooksLikeWebp(blob: Blob): Promise<boolean> {
  const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  return (
    head.length >= 12 &&
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  );
}

export async function loadImageBitmap(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file);
}

export function revokeObjectUrl(url: string | null | undefined) {
  if (url && url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

export function closeImageBitmap(bitmap: ImageBitmap | null | undefined) {
  bitmap?.close();
}
