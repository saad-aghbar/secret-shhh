import { describe, expect, it } from "vitest";

import { appearanceCssVars, gradientCss, wallpaperPaint } from "@/lib/appearance/css";
import { defaultWallpaperConfig } from "@/lib/appearance/config";
import { configFromColor, configFromGradient } from "@/lib/appearance/presets";
import { resolveChatAppearance } from "@/lib/appearance/resolve";

describe("appearance CSS builder", () => {
  it("builds a two-stop gradient from validated hex only", () => {
    expect(gradientCss("#4a756c", "#e4efe9", "vertical")).toBe(
      "linear-gradient(180deg, #4a756c 0%, #e4efe9 100%)",
    );
  });

  it("uses the token wallpaper for the default type", () => {
    expect(wallpaperPaint({ ...defaultWallpaperConfig(), type: "none" })).toBe(
      "var(--shhh-wallpaper)",
    );
  });

  it("emits custom properties without raw user CSS", () => {
    const resolved = resolveChatAppearance({
      personal: configFromColor("#4a756c"),
      shared: { mode: "none", config: {} },
      theme: "light",
    });
    const vars = appearanceCssVars(resolved, "light");
    expect(vars["--shhh-wallpaper-paint"]).toBe(
      "linear-gradient(180deg, #4a756c 0%, #4a756c 100%)",
    );
    expect(JSON.stringify(vars)).not.toMatch(/url\(|javascript|expression/i);
  });

  it("keeps a gradient paint as a constructed linear-gradient", () => {
    const resolved = resolveChatAppearance({
      personal: configFromGradient({ from: "#4a756c", to: "#e4efe9", direction: "diagonal" }),
      shared: { mode: "none", config: {} },
      theme: "dark",
    });
    expect(appearanceCssVars(resolved, "dark")["--shhh-wallpaper-paint"]).toContain("135deg");
  });

  it("emits dim and overlay as unitless 0–1 so the wash can paint live", () => {
    const resolved = resolveChatAppearance({
      personal: { ...configFromColor("#4a756c"), dim: 0.4, overlay: 0.25 },
      shared: { mode: "none", config: {} },
      theme: "light",
    });
    const vars = appearanceCssVars(resolved, "light");
    expect(vars["--shhh-wallpaper-dim"]).toBe("0.400");
    expect(vars["--shhh-wallpaper-overlay"]).toBe("0.250");
  });

  it("emits unitless focal so the photo can pan like a sticker", () => {
    const resolved = resolveChatAppearance({
      personal: { ...configFromColor("#4a756c"), focalX: 0.2, focalY: 0.8, zoom: 2 },
      shared: { mode: "none", config: {} },
      theme: "light",
    });
    const vars = appearanceCssVars(resolved, "light");
    expect(vars["--shhh-wallpaper-focal-x-n"]).toBe("0.200");
    expect(vars["--shhh-wallpaper-focal-y-n"]).toBe("0.800");
    expect(vars["--shhh-wallpaper-pan-x"]).toBe("60.000%");
    expect(vars["--shhh-wallpaper-pan-y"]).toBe("-60.000%");
    expect(vars["--shhh-wallpaper-zoom"]).toBe("2.000");
  });
});
