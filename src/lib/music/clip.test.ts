import { describe, expect, it } from "vitest";

import { tryValidateClipRange, validateClipRange } from "@/lib/music/clip";

describe("clip validation", () => {
  it("enforces a 30 second maximum", () => {
    expect(validateClipRange({ startMs: 1_000, endMs: 31_000 })).toEqual({
      startMs: 1_000,
      endMs: 31_000,
    });
    expect(() => validateClipRange({ startMs: 0, endMs: 31_001 })).toThrow("clip_too_long");
  });

  it("allows a short song to use its full duration", () => {
    expect(validateClipRange({ startMs: 0, endMs: 12_000, durationMs: 12_000 })).toEqual({
      startMs: 0,
      endMs: 12_000,
    });
    expect(() => validateClipRange({ startMs: 0, endMs: 12_001, durationMs: 12_000 })).toThrow(
      "clip_beyond_duration",
    );
  });

  it("rejects malformed ranges", () => {
    expect(tryValidateClipRange({ startMs: -1, endMs: 1_000 })).toBeNull();
    expect(tryValidateClipRange({ startMs: 5_000, endMs: 5_000 })).toBeNull();
  });
});
