import { describe, expect, it } from "vitest";

import {
  contrastRatio,
  darken,
  ensureContrast,
  lighten,
  mix,
  readableForeground,
  relativeLuminance,
  withAlpha,
} from "@/lib/theme/contrast";

describe("theme contrast", () => {
  it("computes WCAG relative luminance and contrast for black and white", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
  });

  it("picks dark text on a pale bubble and light text on a deep one", () => {
    expect(readableForeground("#d4e8e2")).toBe("#2a2622");
    expect(readableForeground("#2a423c")).toBe("#fffdf9");
    expect(readableForeground("#e4c15a")).toBe("#2a2622");
    expect(readableForeground("#3a1a4a")).toBe("#fffdf9");
  });

  it("keeps a readable authored foreground and replaces an impossible one", () => {
    expect(ensureContrast("#2a2622", "#d4e8e2")).toBe("#2a2622");
    expect(ensureContrast("#2a2622", "#1a1210")).toBe("#fffdf9");
  });

  it("mixes, lightens, and darkens deterministically", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(lighten("#4a756c", 0)).toBe("#4a756c");
    expect(darken("#4a756c", 0)).toBe("#4a756c");
    expect(lighten("#4a756c", 1)).toBe("#ffffff");
    expect(darken("#4a756c", 1)).toBe("#000000");
  });

  it("emits rgb alpha without CSS injection", () => {
    expect(withAlpha("#2a2622", 0.12)).toBe("rgb(42 38 34 / 0.12)");
    expect(withAlpha("#000000", 0.55)).toBe("rgb(0 0 0 / 0.55)");
  });
});
