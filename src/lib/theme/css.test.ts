import { describe, expect, it } from "vitest";

import { themeCssText, themeTokenVars } from "@/lib/theme/css";
import { resolveTheme } from "@/lib/theme/resolve";

describe("theme CSS", () => {
  it("emits nothing for uncustomized Light and Dark", () => {
    const light = resolveTheme({ stored: {}, mode: "light" });
    const dark = resolveTheme({ stored: {}, mode: "dark" });
    expect(themeCssText(light, dark)).toBe("");
  });

  it("emits html:root and html:root.dark overrides without raw user CSS", () => {
    const light = resolveTheme({
      stored: { version: 1, preset: "blush", colors: {} },
      mode: "light",
    });
    const dark = resolveTheme({
      stored: { version: 1, preset: "midnight", colors: {} },
      mode: "dark",
    });
    const css = themeCssText(light, dark);
    expect(css).toContain("html:root{");
    expect(css).toContain("html:root.dark{");
    expect(css).toContain("--shhh-accent:");
    expect(css).toContain("--shhh-surface-elevated:");
    expect(css).not.toMatch(/url\(|javascript|expression|var\(|calc\(/i);
  });

  it("maps tokens onto the existing --shhh-* names", () => {
    const resolved = resolveTheme({ stored: {}, mode: "light" });
    const vars = themeTokenVars(resolved.tokens);
    expect(vars["--shhh-bg"]).toBe("#f3efe8");
    expect(vars["--shhh-outgoing"]).toBe("#d4e8e2");
    expect(vars["--shhh-on-accent"]).toBe("#ffffff");
    expect(vars["--shhh-surface-elevated"]).toBe(vars["--shhh-surface-raised"]);
  });
});
