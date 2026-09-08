/**
 * Early non-black frame when duration is known. WebM from MediaRecorder often
 * reports Infinity/NaN — still capture whatever frame is already decoded.
 */
export function posterSeekSeconds(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(1, duration * 0.1);
}
