import {
  apiRecordVideoPart,
  apiSignVideoParts,
  uploadBlobWithProgress,
} from "@/lib/media/client-api";
import { partByteRange } from "@/lib/media/video-parts";

export class VideoUploadPausedError extends Error {
  constructor() {
    super("paused");
    this.name = "VideoUploadPausedError";
  }
}

const MAX_PART_RETRIES = 5;
const SIGN_BATCH = 8;

function partBackoffMs(retry: number) {
  const base = Math.min(8_000, 400 * 2 ** retry);
  return base + Math.floor(Math.random() * 250);
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Upload canceled", "AbortError"));
      return;
    }
    const timer = window.setTimeout(() => resolve(), ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new DOMException("Upload canceled", "AbortError"));
      },
      { once: true },
    );
  });
}

export async function uploadMissingVideoParts(input: {
  file: File;
  sessionId: string;
  partSize: number;
  totalParts: number;
  totalBytes: number;
  completedParts: Set<number>;
  concurrency: () => number;
  signal: AbortSignal;
  onPartComplete: (part: {
    partNumber: number;
    etag: string;
    sizeBytes: number;
    uploadedBytes: number;
  }) => Promise<void>;
  onProgress: (uploadedBytes: number) => void;
}) {
  const missing = Array.from({ length: input.totalParts }, (_, i) => i + 1).filter(
    (partNumber) => !input.completedParts.has(partNumber),
  );

  let inFlightBytes = 0;
  const completedBytes = () => {
    let sum = 0;
    for (let partNumber = 1; partNumber <= input.totalParts; partNumber += 1) {
      if (!input.completedParts.has(partNumber)) continue;
      sum += partByteRange(input.totalBytes, input.partSize, partNumber).size;
    }
    return sum;
  };

  for (let i = 0; i < missing.length; ) {
    if (input.signal.aborted) {
      throw new DOMException("Upload canceled", "AbortError");
    }
    const limit = input.concurrency();
    if (limit < 1) {
      throw new VideoUploadPausedError();
    }
    const batchNumbers = missing.slice(i, i + Math.min(SIGN_BATCH, Math.max(limit, 1)));
    const signed = await apiSignVideoParts(input.sessionId, batchNumbers);
    const byNumber = new Map(signed.parts.map((part) => [part.partNumber, part.upload]));

    await mapPool(batchNumbers, limit, async (partNumber) => {
      if (input.completedParts.has(partNumber)) return;
      if (input.concurrency() < 1) throw new VideoUploadPausedError();
      const upload = byNumber.get(partNumber);
      if (!upload) throw new Error("Couldn't send · Tap to retry");
      const range = partByteRange(input.totalBytes, input.partSize, partNumber);
      const slice = input.file.slice(range.start, range.endExclusive);
      let etag: string | null = null;
      for (let attempt = 0; attempt <= MAX_PART_RETRIES; attempt += 1) {
        if (input.signal.aborted) {
          throw new DOMException("Upload canceled", "AbortError");
        }
        if (input.concurrency() < 1) throw new VideoUploadPausedError();
        try {
          const result = await uploadBlobWithProgress({
            url: upload.url,
            method: upload.method,
            headers: upload.headers,
            blob: slice,
            signal: input.signal,
            onProgress: (loaded) => {
              input.onProgress(completedBytes() + inFlightBytes + loaded);
            },
          });
          etag = result.etag;
          if (!etag) throw new Error("Couldn't send · Tap to retry");
          break;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") throw error;
          if (attempt >= MAX_PART_RETRIES) throw error;
          await sleep(partBackoffMs(attempt), input.signal);
        }
      }
      if (!etag) throw new Error("Couldn't send · Tap to retry");
      await apiRecordVideoPart(input.sessionId, partNumber, {
        etag,
        sizeBytes: range.size,
      });
      input.completedParts.add(partNumber);
      inFlightBytes = 0;
      const uploadedBytes = completedBytes();
      await input.onPartComplete({
        partNumber,
        etag,
        sizeBytes: range.size,
        uploadedBytes,
      });
      input.onProgress(uploadedBytes);
    });

    i += batchNumbers.length;
  }
}

async function mapPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  const queue = [...items];
  const n = Math.max(1, Math.min(limit, queue.length) || 1);
  await Promise.all(
    Array.from({ length: n }, async () => {
      for (;;) {
        const item = queue.shift();
        if (item === undefined) return;
        await worker(item);
      }
    }),
  );
}
