import { describe, expect, it } from "vitest";

import { ThemeValidationError, parseThemeConfig, parseThemeConfigLoose } from "@/lib/theme/validation";

const valid = {
  version: 1,
  preset: "blush",
  colors: { accent: "#B56D5C" },
};

describe("theme validation", () => {
  it("accepts a version-1 config and lowercases hex", () => {
    const parsed = parseThemeConfig(valid, "light");
    expect(parsed.preset).toBe("blush");
    expect(parsed.colors.accent).toBe("#b56d5c");
  });

  it("rejects unknown versions, presets, keys, and empty saves", () => {
    expect(() => parseThemeConfig({ ...valid, version: 99 }, "light")).toThrow(ThemeValidationError);
    expect(() => parseThemeConfig({ ...valid, preset: "midnight" }, "light")).toThrow(
      ThemeValidationError,
    );
    expect(() => parseThemeConfig({ ...valid, extra: true }, "light")).toThrow(ThemeValidationError);
    expect(() => parseThemeConfig({}, "light")).toThrow(ThemeValidationError);
    expect(parseThemeConfigLoose({}, "light")).toBeNull();
  });

  it("rejects non-#rrggbb colors and CSS injection", () => {
    const hostile = [
      "#fff",
      "red",
      "rgb(0,0,0)",
      "url(javascript:alert(1))",
      "var(--shhh-bg)",
      "calc(1px)",
      "#b56d5c; background: url(x)",
      "#b56d5c<",
    ];
    for (const accent of hostile) {
      expect(() => parseThemeConfig({ ...valid, colors: { accent } }, "light")).toThrow(
        ThemeValidationError,
      );
    }
  });
});
