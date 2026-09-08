import { describe, expect, it } from "vitest";

import { VOICE_WAVEFORM_BUCKETS } from "@/lib/media/validation";
import {
  compressWaveform,
  frameAmplitude,
  recentWaveform,
  resampleWaveform,
  seekFractionFromPointer,
  voiceTrackWidthRem,
  waveformBarCount,
  WAVEFORM_MAX_BAR,
  WAVEFORM_MIN_BAR,
} from "@/lib/media/waveform";

function inRange(values: number[]) {
  return values.every(
    (value) => Number.isInteger(value) && value >= WAVEFORM_MIN_BAR && value <= WAVEFORM_MAX_BAR,
  );
}

describe("frameAmplitude", () => {
  it("is zero for silence and one for a full-scale signal", () => {
    expect(frameAmplitude(new Float32Array(64))).toBe(0);
    expect(frameAmplitude([1, -1, 1, -1])).toBe(1);
  });

  it("handles an empty frame without dividing by zero", () => {
    expect(frameAmplitude([])).toBe(0);
  });
});

describe("compressWaveform", () => {
  it("always produces the requested bucket count in range", () => {
    const readings = Array.from({ length: 5_000 }, (_, i) => Math.abs(Math.sin(i / 40)) * 0.4);
    const samples = compressWaveform(readings);
    expect(samples).toHaveLength(VOICE_WAVEFORM_BUCKETS);
    expect(inRange(samples)).toBe(true);
  });

  it("keeps a silent clip flat instead of amplifying room noise", () => {
    const samples = compressWaveform(new Array(400).fill(0.001), 16);
    expect(samples).toEqual(new Array(16).fill(WAVEFORM_MIN_BAR));
  });

  it("keeps a loud clip within bounds and still shows dynamics", () => {
    const readings = [...new Array(50).fill(1), ...new Array(50).fill(0.1)];
    const samples = compressWaveform(readings, 4);
    expect(inRange(samples)).toBe(true);
    expect(samples[0]).toBe(WAVEFORM_MAX_BAR);
    expect(samples[3]!).toBeLessThan(samples[0]!);
  });

  it("stretches a very short clip rather than leaving gaps", () => {
    const samples = compressWaveform([0.2, 0.9], 12);
    expect(samples).toHaveLength(12);
    expect(inRange(samples)).toBe(true);
  });

  it("returns a flat track when nothing was recorded", () => {
    expect(compressWaveform([], 8)).toEqual(new Array(8).fill(WAVEFORM_MIN_BAR));
  });

  it("preserves peaks so transients stay visible", () => {
    // One loud spike inside an otherwise quiet bucket must survive compression.
    const readings = [...new Array(19).fill(0.05), 1, ...new Array(20).fill(0.05)];
    const samples = compressWaveform(readings, 2);
    expect(Math.max(...samples)).toBe(WAVEFORM_MAX_BAR);
  });
});

describe("resampleWaveform", () => {
  it("downsamples and upsamples to an exact bar count", () => {
    const stored = compressWaveform(
      Array.from({ length: 900 }, (_, i) => Math.abs(Math.cos(i / 15)) * 0.6),
    );
    expect(resampleWaveform(stored, 12)).toHaveLength(12);
    expect(resampleWaveform(stored, 120)).toHaveLength(120);
    expect(inRange(resampleWaveform(stored, 120))).toBe(true);
  });

  it("survives an empty or degenerate request", () => {
    expect(resampleWaveform([], 5)).toEqual(new Array(5).fill(WAVEFORM_MIN_BAR));
    expect(resampleWaveform([50], 0)).toHaveLength(1);
  });
});

describe("recentWaveform", () => {
  it("pads a young recording so bars grow into an existing track", () => {
    const bars = recentWaveform([0.5], 10);
    expect(bars).toHaveLength(10);
    expect(bars.slice(0, 9)).toEqual(new Array(9).fill(WAVEFORM_MIN_BAR));
    expect(bars[9]).toBe(WAVEFORM_MAX_BAR);
  });

  it("shows only the tail once the recording is longer than the track", () => {
    const readings = [...new Array(100).fill(0.01), 1];
    const bars = recentWaveform(readings, 8);
    expect(bars).toHaveLength(8);
    expect(bars[7]).toBe(WAVEFORM_MAX_BAR);
  });

  it("stays flat while the room is silent", () => {
    expect(recentWaveform(new Array(40).fill(0), 6)).toEqual(new Array(6).fill(WAVEFORM_MIN_BAR));
  });
});

describe("waveform layout", () => {
  it("keeps bar density constant as the track grows", () => {
    expect(waveformBarCount(0)).toBe(12);
    expect(waveformBarCount(102)).toBe(20);
    expect(waveformBarCount(10_000)).toBe(64);
  });

  it("gives short clips a narrower track than long ones", () => {
    expect(voiceTrackWidthRem(3_000)).toBeLessThan(voiceTrackWidthRem(30_000));
    expect(voiceTrackWidthRem(30_000)).toBeLessThan(voiceTrackWidthRem(300_000));
    expect(voiceTrackWidthRem(0)).toBeGreaterThan(0);
  });

  it("steps width instead of stretching linearly with duration", () => {
    expect(voiceTrackWidthRem(1_000)).toBe(6.75);
    expect(voiceTrackWidthRem(5_000)).toBe(6.75);
    expect(voiceTrackWidthRem(6_000)).toBe(8.5);
    expect(voiceTrackWidthRem(15_000)).toBe(8.5);
    expect(voiceTrackWidthRem(16_000)).toBe(10.5);
    expect(voiceTrackWidthRem(60_000)).toBe(10.5);
    expect(voiceTrackWidthRem(61_000)).toBe(11.5);
  });
});

describe("seekFractionFromPointer", () => {
  const rect = { left: 100, width: 200 } as DOMRect;

  it("maps a pointer to a clamped fraction", () => {
    expect(seekFractionFromPointer(100, rect)).toBe(0);
    expect(seekFractionFromPointer(200, rect)).toBe(0.5);
    expect(seekFractionFromPointer(300, rect)).toBe(1);
  });

  it("clamps a drag that leaves the track", () => {
    expect(seekFractionFromPointer(-50, rect)).toBe(0);
    expect(seekFractionFromPointer(9_999, rect)).toBe(1);
    expect(seekFractionFromPointer(150, { left: 0, width: 0 } as DOMRect)).toBe(0);
  });
});
