import { VOICE_WAVEFORM_BUCKETS } from "@/lib/media/validation";

/**
 * Voice waveform bars.
 *
 * Recording samples the analyser about 20 times a second, which gives a variable
 * number of readings. Those are compressed to a fixed bucket count once, at send
 * time, and stored with the message — so playback never decodes the audio to draw
 * bars. Render resamples the stored buckets again to whatever width is available.
 */

/**
 * Silence still reads as a quiet rail rather than a gap in the bubble. Anything
 * smaller than this and a pause between words looks like dust on the screen.
 */
export const WAVEFORM_MIN_BAR = 16;
export const WAVEFORM_MAX_BAR = 100;

/** Below this, a recording is room noise and should stay visually flat. */
const NOISE_FLOOR = 0.015;

const BAR_WIDTH_PX = 3;
const BAR_GAP_PX = 2;

function clampBar(value: number): number {
  if (!Number.isFinite(value)) return WAVEFORM_MIN_BAR;
  return Math.min(WAVEFORM_MAX_BAR, Math.max(WAVEFORM_MIN_BAR, Math.round(value)));
}

/** Root-mean-square level of one analyser frame, 0–1. */
export function frameAmplitude(frame: Float32Array | number[]): number {
  const length = frame.length;
  if (length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < length; i += 1) {
    const value = frame[i] ?? 0;
    sum += value * value;
  }
  const rms = Math.sqrt(sum / length);
  return Number.isFinite(rms) ? Math.min(1, Math.max(0, rms)) : 0;
}

function bucketPeaks(readings: number[], buckets: number): number[] {
  const peaks: number[] = [];
  for (let i = 0; i < buckets; i += 1) {
    const start = Math.floor((i * readings.length) / buckets);
    const end = Math.max(start + 1, Math.floor(((i + 1) * readings.length) / buckets));
    let peak = 0;
    for (let j = start; j < end && j < readings.length; j += 1) {
      const value = readings[j] ?? 0;
      if (value > peak) peak = value;
    }
    peaks.push(peak);
  }
  return peaks;
}

/**
 * Compress a whole recording envelope to integers 0–100 for storage.
 *
 * Buckets keep their peak rather than their mean so consonants and laughter stay
 * visible. Heights are relative to the loudest moment, then lifted by a square root
 * because raw RMS of speech sits low enough to look like a flat line otherwise.
 */
export function compressWaveform(
  readings: number[],
  buckets: number = VOICE_WAVEFORM_BUCKETS,
): number[] {
  const count = Math.max(1, Math.floor(buckets));
  if (readings.length === 0) {
    return new Array<number>(count).fill(WAVEFORM_MIN_BAR);
  }

  const peaks = bucketPeaks(readings, count);
  let loudest = 0;
  for (const peak of peaks) {
    if (peak > loudest) loudest = peak;
  }
  if (loudest <= NOISE_FLOOR) {
    return new Array<number>(count).fill(WAVEFORM_MIN_BAR);
  }

  return peaks.map((peak) => clampBar(Math.sqrt(peak / loudest) * WAVEFORM_MAX_BAR));
}

/** Resample stored buckets to exactly `bars` values for rendering. */
export function resampleWaveform(samples: number[], bars: number): number[] {
  const count = Math.max(1, Math.floor(bars));
  if (samples.length === 0) {
    return new Array<number>(count).fill(WAVEFORM_MIN_BAR);
  }
  if (samples.length === count) {
    return samples.map(clampBar);
  }
  return bucketPeaks(samples, count).map(clampBar);
}

/**
 * Live recording view: the most recent readings, scrolling right to left, with the
 * track pre-filled so the bars grow into an existing shape instead of empty space.
 */
export function recentWaveform(readings: number[], bars: number): number[] {
  const count = Math.max(1, Math.floor(bars));
  const tail = readings.slice(-count);
  let loudest = 0;
  for (const value of tail) {
    if (value > loudest) loudest = value;
  }
  const scale = loudest <= NOISE_FLOOR ? 0 : loudest;
  const scaled = tail.map((value) =>
    scale === 0 ? WAVEFORM_MIN_BAR : clampBar(Math.sqrt(value / scale) * WAVEFORM_MAX_BAR),
  );
  if (scaled.length >= count) return scaled;
  return [...new Array<number>(count - scaled.length).fill(WAVEFORM_MIN_BAR), ...scaled];
}

/** How many bars fit a track, so density stays constant instead of stretching. */
export function waveformBarCount(widthPx: number, minBars = 12, maxBars = 64): number {
  if (!Number.isFinite(widthPx) || widthPx <= 0) return minBars;
  const fits = Math.floor((widthPx + BAR_GAP_PX) / (BAR_WIDTH_PX + BAR_GAP_PX));
  return Math.min(maxBars, Math.max(minBars, fits));
}

/**
 * Bubble track width in rem. Stepped, not linear — a ten-minute note must not
 * become a full-width slab, and a one-second note must not vanish.
 */
export function voiceTrackWidthRem(durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return 6.75;
  const seconds = durationMs / 1000;
  if (seconds <= 5) return 6.75;
  if (seconds <= 15) return 8.5;
  if (seconds <= 60) return 10.5;
  return 11.5;
}

/** Fraction of the clip a pointer at `clientX` refers to, clamped to 0–1. */
export function seekFractionFromPointer(clientX: number, rect: DOMRect): number {
  if (rect.width <= 0) return 0;
  const offset = clientX - rect.left;
  return Math.min(1, Math.max(0, offset / rect.width));
}
