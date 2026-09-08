import { describe, expect, it } from "vitest";

import { mapConnectionQuality, nextQualityStep, qualityCopy } from "@/lib/calls/quality";

describe("adaptive quality", () => {
  it("maps LiveKit qualities without touching audio", () => {
    expect(mapConnectionQuality("excellent")).toBe("good");
    expect(mapConnectionQuality("good")).toBe("good");
    expect(mapConnectionQuality("poor")).toBe("weak");
    expect(mapConnectionQuality("lost")).toBe("reconnecting");
    expect(mapConnectionQuality("reconnecting")).toBe("reconnecting");
  });

  it("walks the degradation ladder then recovers", () => {
    expect(nextQualityStep("full", "weak")).toBe("reduced");
    expect(nextQualityStep("reduced", "weak")).toBe("low");
    expect(nextQualityStep("low", "weak")).toBe("paused");
    expect(nextQualityStep("paused", "weak")).toBe("paused");
    expect(nextQualityStep("paused", "good")).toBe("low");
    expect(nextQualityStep("low", "good")).toBe("reduced");
    expect(nextQualityStep("reduced", "good")).toBe("full");
  });

  it("uses audio-first copy", () => {
    expect(qualityCopy("weak", false)).toBe("Connection is weak — keeping audio connected.");
    expect(qualityCopy("reconnecting", false)).toBe("Reconnecting…");
  });
});
