/** R2 requires every part except the last to be at least 5 MiB. */
export const R2_MIN_PART_BYTES = 5 * 1024 * 1024;
/** R2 part ceiling. */
export const R2_MAX_PART_BYTES = 5 * 1024 * 1024 * 1024;
export const R2_MAX_PARTS = 10_000;
/** Architectural R2 object ceiling (4.995 TiB). */
export const R2_MAX_OBJECT_BYTES = 4.995 * 1024 * 1024 * 1024 * 1024;

/**
 * Default part size: 8 MiB.
 * Clears the 5 MiB floor, keeps one Blob slice modest on iPhone, and makes a
 * failed retry cheap. Larger files raise the size just enough to stay within
 * 10,000 uniform parts.
 */
export const VIDEO_UPLOAD_PART_BYTES = 8 * 1024 * 1024;

const MIB = 1024 * 1024;

export type VideoPartPlan = {
  partSize: number;
  totalParts: number;
  lastPartSize: number;
};

export function videoPartSizeFor(totalBytes: number): number {
  if (!Number.isFinite(totalBytes) || totalBytes < 1) {
    throw new Error("Video size is required.");
  }
  const minimumForPartLimit = Math.ceil(totalBytes / R2_MAX_PARTS);
  const roundedMiB = Math.ceil(Math.max(VIDEO_UPLOAD_PART_BYTES, minimumForPartLimit) / MIB) * MIB;
  return Math.min(Math.max(roundedMiB, VIDEO_UPLOAD_PART_BYTES), R2_MAX_PART_BYTES);
}

export function videoPartPlan(totalBytes: number): VideoPartPlan {
  const partSize = videoPartSizeFor(totalBytes);
  const totalParts = Math.ceil(totalBytes / partSize);
  const lastPartSize = totalBytes - partSize * (totalParts - 1);
  return { partSize, totalParts, lastPartSize };
}

export function partByteRange(
  totalBytes: number,
  partSize: number,
  partNumber: number,
): { start: number; endExclusive: number; size: number } {
  const start = (partNumber - 1) * partSize;
  const endExclusive = Math.min(totalBytes, start + partSize);
  return { start, endExclusive, size: endExclusive - start };
}

export function assertPartSizeCoversConfiguredMax(maxVideoBytes: number) {
  const plan = videoPartPlan(maxVideoBytes);
  if (plan.totalParts > R2_MAX_PARTS) {
    throw new Error("Configured MAX_VIDEO_BYTES exceeds the 10,000-part R2 limit.");
  }
  if (plan.partSize < R2_MIN_PART_BYTES && plan.totalParts > 1) {
    throw new Error("Part size is below the R2 5 MiB minimum.");
  }
  return plan;
}
