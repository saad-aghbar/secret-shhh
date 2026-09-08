import { describe, expect, it } from "vitest";

import { defaultThemeConfig } from "@/lib/theme/config";
import { SHHH_DARK_TOKENS, SHHH_LIGHT_TOKENS } from "@/lib/theme/derive";
import { resolveMode, resolveTheme } from "@/lib/theme/resolve";

describe("theme resolve", () => {
  it("falls back to the Shhh defaults for empty storage", () => {
    const light = resolveTheme({ stored: {}, mode: "light" });
    const dark = resolveTheme({ stored: {}, mode: "dark" });
    expect(light.isDefault).toBe(true);
    expect(dark.isDefault).toBe(true);
    expect(light.tokens).toEqual(SHHH_LIGHT_TOKENS);
    expect(dark.tokens).toEqual(SHHH_DARK_TOKENS);
  });

  it("resolves Light, Dark, System→light, and System→dark independently", () => {
    expect(resolveMode("light", true)).toBe("light");
    expect(resolveMode("dark", false)).toBe("dark");
    expect(resolveMode("system", false)).toBe("light");
    expect(resolveMode("system", true)).toBe("dark");
  });

  it("keeps Light outgoing independent from Dark outgoing", () => {
    const light = resolveTheme({
      stored: { version: 1, preset: "shhh", colors: { outgoing: "#7eb8ff" } },
      mode: "light",
    });
    const dark = resolveTheme({
      stored: { version: 1, preset: "shhh", colors: { outgoing: "#1b3a5c" } },
      mode: "dark",
    });
    expect(light.tokens.outgoing).toBe("#7eb8ff");
    expect(dark.tokens.outgoing).toBe("#1b3a5c");
  });

  it("falls back to Shhh when the stored config is invalid", () => {
    const resolved = resolveTheme({
      stored: { version: 99, preset: "nope", colors: { accent: "red" } },
      mode: "light",
    });
    expect(resolved.isDefault).toBe(true);
    expect(resolved.config).toEqual(defaultThemeConfig());
    expect(resolved.tokens.accent).toBe(SHHH_LIGHT_TOKENS.accent);
  });

  it("follows an accent override onto button and selected nav unless those were authored", () => {
    const derived = resolveTheme({
      stored: { version: 1, preset: "shhh", colors: { accent: "#b56d5c" } },
      mode: "light",
    });
    expect(derived.authored.button).toBe("#b56d5c");
    expect(derived.authored.navSelected).toBe("#b56d5c");

    const pinned = resolveTheme({
      stored: {
        version: 1,
        preset: "shhh",
        colors: { accent: "#b56d5c", button: "#3f6f5e" },
      },
      mode: "light",
    });
    expect(pinned.authored.button).toBe("#3f6f5e");
    expect(pinned.authored.navSelected).toBe("#b56d5c");
  });

  it("treats a reset empty object as the Shhh default", () => {
    const reset = resolveTheme({ stored: {}, mode: "dark" });
    expect(reset.isDefault).toBe(true);
    expect(reset.tokens.bg).toBe(SHHH_DARK_TOKENS.bg);
  });
});
