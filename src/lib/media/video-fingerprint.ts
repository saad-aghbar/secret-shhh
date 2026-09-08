import { videoPartPlan } from "@/lib/media/video-parts";

export { videoPartPlan, videoPartSizeFor, VIDEO_UPLOAD_PART_BYTES } from "@/lib/media/video-parts";

const FINGERPRINT_SLICE = 1024 * 1024;

function toHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Resume identity — not a full-file checksum.
 * name + size + lastModified + SHA-256(first 1 MiB || last 1 MiB).
 * Does not prove every byte of a multi-GB original.
 */
export async function videoResumeFingerprint(file: {
  name: string;
  size: number;
  lastModified: number;
  slice: (start: number, end?: number) => Blob;
}): Promise<string> {
  const first = file.slice(0, Math.min(FINGERPRINT_SLICE, file.size));
  const lastStart = Math.max(0, file.size - FINGERPRINT_SLICE);
  const last = file.slice(lastStart);
  const digest = await crypto.subtle.digest("SHA-256", await new Blob([first, last]).arrayBuffer());
  return `${file.name}|${file.size}|${file.lastModified}|${toHex(digest)}`;
}

export function fingerprintsMatch(expected: string, actual: string) {
  return expected === actual;
}

export function videoPartCountForSize(totalBytes: number) {
  return videoPartPlan(totalBytes).totalParts;
}
