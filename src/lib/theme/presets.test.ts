import { describe, expect, it } from "vitest";

import { contrastRatio } from "@/lib/theme/contrast";
import { deriveThemeTokens } from "@/lib/theme/derive";
import { DARK_THEME_PRESETS, LIGHT_THEME_PRESETS } from "@/lib/theme/presets";

function expectReadable(
  tokens: ReturnType<typeof deriveThemeTokens>,
  options?: { historicOnAccent?: boolean },
) {
  expect(contrastRatio(tokens.text, tokens.bg)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(tokens.outgoingText, tokens.outgoing)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(tokens.incomingText, tokens.incoming)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(tokens.navText, tokens.navSurface)).toBeGreaterThanOrEqual(4.5);
  if (options?.historicOnAccent) return;
  expect(contrastRatio(tokens.onButton, tokens.button)).toBeGreaterThanOrEqual(3);
  expect(contrastRatio(tokens.onAccent, tokens.accent)).toBeGreaterThanOrEqual(3);
}

describe("theme presets", () => {
  it("designs Light and Dark catalogs independently", () => {
    const lightIds = LIGHT_THEME_PRESETS.map((preset) => preset.id);
    const darkIds = DARK_THEME_PRESETS.map((preset) => preset.id);
    expect(lightIds).toContain("blush");
    expect(darkIds).toContain("midnight");
    expect(LIGHT_THEME_PRESETS.find((preset) => preset.id === "blush")?.colors.accent).not.toBe(
      DARK_THEME_PRESETS.find((preset) => preset.id === "rose")?.colors.accent,
    );
  });

  it("keeps every curated preset readable", () => {
    for (const preset of LIGHT_THEME_PRESETS) {
      expectReadable(deriveThemeTokens("light", preset.colors), {
        historicOnAccent: preset.id === "shhh",
      });
    }
    for (const preset of DARK_THEME_PRESETS) {
      expectReadable(deriveThemeTokens("dark", preset.colors), {
        historicOnAccent: preset.id === "shhh",
      });
    }
  });
});
