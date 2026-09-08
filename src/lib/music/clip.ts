export const MUSIC_CLIP_MAX_MS = 30_000;
export const MUSIC_LISTENED_THRESHOLD_MS = 4_000;

export type ClipRange = {
  startMs: number;
  endMs: number;
};

export function maxClipMs(durationMs: number | null | undefined) {
  if (typeof durationMs === "number" && durationMs > 0 && durationMs < MUSIC_CLIP_MAX_MS) {
    return durationMs;
  }
  return MUSIC_CLIP_MAX_MS;
}

export function validateClipRange(input: {
  startMs: number;
  endMs: number;
  durationMs?: number | null;
}): ClipRange {
  const startMs = Math.floor(input.startMs);
  const endMs = Math.floor(input.endMs);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    throw new Error("invalid_clip");
  }
  if (startMs < 0 || endMs <= startMs) {
    throw new Error("invalid_clip");
  }
  if (typeof input.durationMs === "number" && input.durationMs > 0 && endMs > input.durationMs) {
    throw new Error("clip_beyond_duration");
  }
  const max = maxClipMs(input.durationMs);
  if (endMs - startMs > max) {
    throw new Error("clip_too_long");
  }
  return { startMs, endMs };
}

export function tryValidateClipRange(input: {
  startMs: number;
  endMs: number;
  durationMs?: number | null;
}): ClipRange | null {
  try {
    return validateClipRange(input);
  } catch {
    return null;
  }
}

export function formatClipLabel(startMs: number, endMs: number) {
  return `${formatClock(startMs)} – ${formatClock(endMs)}`;
}

export function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
