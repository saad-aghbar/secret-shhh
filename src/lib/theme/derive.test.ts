import { describe, expect, it } from "vitest";

import { contrastRatio } from "@/lib/theme/contrast";
import {
  deriveThemeTokens,
  SHHH_DARK_AUTHORED,
  SHHH_DARK_TOKENS,
  SHHH_LIGHT_AUTHORED,
  SHHH_LIGHT_TOKENS,
} from "@/lib/theme/derive";

describe("theme derive", () => {
  it("reproduces the exact Shhh Light tokens from the authored defaults", () => {
    expect(deriveThemeTokens("light", SHHH_LIGHT_AUTHORED)).toEqual(SHHH_LIGHT_TOKENS);
  });

  it("reproduces the exact Shhh Dark tokens from the authored defaults", () => {
    expect(deriveThemeTokens("dark", SHHH_DARK_AUTHORED)).toEqual(SHHH_DARK_TOKENS);
  });

  it("derives readable bubble and button text for a custom light theme", () => {
    const tokens = deriveThemeTokens("light", {
      ...SHHH_LIGHT_AUTHORED,
      outgoing: "#7eb8ff",
      incoming: "#e4d4f5",
      accent: "#2f6b3a",
      button: "#2f6b3a",
    });
    expect(contrastRatio(tokens.outgoingText, tokens.outgoing)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.incomingText, tokens.incoming)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.onButton, tokens.button)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.text, tokens.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("does not copy a light override into a dark derivation", () => {
    const light = deriveThemeTokens("light", { ...SHHH_LIGHT_AUTHORED, outgoing: "#ffb6c1" });
    const dark = deriveThemeTokens("dark", SHHH_DARK_AUTHORED);
    expect(light.outgoing).toBe("#ffb6c1");
    expect(dark.outgoing).toBe(SHHH_DARK_TOKENS.outgoing);
  });

  it("keeps extreme near-white pairs readable instead of rejecting them", () => {
    const tokens = deriveThemeTokens("light", {
      ...SHHH_LIGHT_AUTHORED,
      background: "#fffef0",
      surface: "#ffffff",
      outgoing: "#ffff00",
      incoming: "#fefefe",
      accent: "#d0d0d0",
      button: "#d0d0d0",
      composer: "#ffffff",
      sheet: "#ffffff",
    });
    expect(contrastRatio(tokens.outgoingText, tokens.outgoing)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.incomingText, tokens.incoming)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.text, tokens.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.onButton, tokens.button)).toBeGreaterThanOrEqual(3);
    expect(tokens.outgoingText).toBe("#2a2622");
  });
});
