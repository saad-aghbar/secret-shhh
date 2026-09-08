import { describe, expect, it } from "vitest";

import { editorBaseline } from "@/features/appearance/use-appearance-draft";
import {
  defaultWallpaperConfig,
  isEmptyWallpaperRecord,
  wallpaperPaintKey,
} from "@/lib/appearance/config";
import { overlayFloorFor, resolveChatAppearance } from "@/lib/appearance/resolve";
import { configFromColor, configFromDefault, configFromGradient } from "@/lib/appearance/presets";
import type { AppearancePayload } from "@/lib/appearance/types";
import { wallpaperExtensionForMime } from "@/lib/appearance/object-keys";
import {
  AppearanceValidationError,
  parsePersonalOverride,
  parseWallpaperConfig,
  validateWallpaperUploadMeta,
} from "@/lib/appearance/validation";

function solid(color = "#4a756c") {
  return configFromColor(color);
}

function gradient() {
  return configFromGradient({ from: "#4a756c", to: "#e4efe9", direction: "vertical" });
}

function image(assetId = "11111111-1111-4111-8111-111111111111") {
  return { ...defaultWallpaperConfig(), type: "image" as const, assetId };
}

function shared(mode: "none" | "solid" | "gradient" | "image", config: unknown, mediaId?: string) {
  return { mode, config, mediaId };
}

describe("wallpaper validation", () => {
  it("accepts a strict version-1 solid config and lowercases hex", () => {
    const parsed = parseWallpaperConfig({
      version: 1,
      type: "solid",
      color: "#4A756C",
      blur: 0.2,
      dim: 0.1,
      overlay: 0.3,
      focalX: 0.4,
      focalY: 0.6,
      zoom: 1.5,
    });
    expect(parsed.color).toBe("#4a756c");
    expect(parsed.blur).toBe(0.2);
  });

  it("rejects unknown versions", () => {
    expect(() => parseWallpaperConfig({ ...solid(), version: 99 })).toThrow(
      AppearanceValidationError,
    );
  });

  it("rejects empty objects as a save payload", () => {
    expect(() => parseWallpaperConfig({})).toThrow(AppearanceValidationError);
    expect(isEmptyWallpaperRecord({})).toBe(true);
    expect(parsePersonalOverride({})).toBeNull();
  });

  it("treats type none as an active personal override", () => {
    const override = parsePersonalOverride(configFromDefault());
    expect(override?.type).toBe("none");
  });

  it("rejects non-#rrggbb colors and CSS injection", () => {
    const bad = [
      "#fff",
      "red",
      "rgb(0,0,0)",
      "url(javascript:alert(1))",
      "linear-gradient(red, blue)",
      "#4a756c; background: url(x)",
    ];
    for (const color of bad) {
      expect(() => parseWallpaperConfig({ ...solid(), color })).toThrow(AppearanceValidationError);
    }
  });

  it("rejects NaN, Infinity, and out-of-range numbers", () => {
    expect(() => parseWallpaperConfig({ ...solid(), blur: Number.NaN })).toThrow(
      AppearanceValidationError,
    );
    expect(() => parseWallpaperConfig({ ...solid(), dim: Number.POSITIVE_INFINITY })).toThrow(
      AppearanceValidationError,
    );
    expect(() => parseWallpaperConfig({ ...solid(), overlay: -1 })).not.toThrow();
    const clamped = parseWallpaperConfig({ ...solid(), overlay: 4, zoom: 99, focalX: -2 });
    expect(clamped.overlay).toBe(1);
    expect(clamped.zoom).toBe(3);
    expect(clamped.focalX).toBe(0);
  });

  it("rejects extra keys and missing type-specific fields", () => {
    expect(() => parseWallpaperConfig({ ...solid(), css: "url(x)" })).toThrow(
      AppearanceValidationError,
    );
    expect(() => parseWallpaperConfig({ ...defaultWallpaperConfig(), type: "solid" })).toThrow(
      AppearanceValidationError,
    );
    expect(() => parseWallpaperConfig({ ...defaultWallpaperConfig(), type: "image" })).toThrow(
      AppearanceValidationError,
    );
  });
});

describe("wallpaper upload mime", () => {
  it("accepts the display formats the browser can actually emit", () => {
    for (const mimeType of ["image/webp", "image/jpeg", "image/png", "image/gif"]) {
      expect(
        validateWallpaperUploadMeta({ mimeType, size: 1200, width: 800, height: 1000 }).ok,
      ).toBe(true);
    }
    expect(wallpaperExtensionForMime("image/png")).toBe("png");
    expect(wallpaperExtensionForMime("image/gif")).toBe("gif");
    expect(wallpaperExtensionForMime("image/jpeg")).toBe("jpg");
  });

  it("rejects HEIC and SVG as stored wallpaper bytes", () => {
    expect(
      validateWallpaperUploadMeta({
        mimeType: "image/heic",
        size: 1200,
        width: 800,
        height: 1000,
      }).ok,
    ).toBe(false);
    expect(
      validateWallpaperUploadMeta({
        mimeType: "image/svg+xml",
        size: 1200,
        width: 800,
        height: 1000,
      }).ok,
    ).toBe(false);
  });
});

describe("resolveChatAppearance precedence", () => {
  const noneShared = shared("none", {});

  it("uses default when personal is empty and shared is none", () => {
    const resolved = resolveChatAppearance({
      personal: {},
      shared: noneShared,
      theme: "light",
    });
    expect(resolved.source).toBe("default");
    expect(resolved.layer.type).toBe("none");
  });

  it("uses shared when personal is empty and shared is set", () => {
    const resolved = resolveChatAppearance({
      personal: {},
      shared: shared("solid", solid()),
      theme: "light",
    });
    expect(resolved.source).toBe("shared");
    expect(resolved.layer.color).toBe("#4a756c");
  });

  it("lets a personal override beat shared", () => {
    const resolved = resolveChatAppearance({
      personal: solid("#d9899c"),
      shared: shared("solid", solid("#4a756c")),
      theme: "light",
    });
    expect(resolved.source).toBe("personal");
    expect(resolved.layer.color).toBe("#d9899c");
  });

  it("lets personal type none beat a shared wallpaper", () => {
    const resolved = resolveChatAppearance({
      personal: configFromDefault(),
      shared: shared("gradient", gradient()),
      theme: "dark",
    });
    expect(resolved.source).toBe("personal");
    expect(resolved.layer.type).toBe("none");
  });

  it("does not treat an invalid personal blob as an override", () => {
    const resolved = resolveChatAppearance({
      personal: { version: 99, type: "solid", color: "#4a756c" },
      shared: shared("solid", solid("#c48b7a")),
      theme: "light",
    });
    expect(resolved.source).toBe("shared");
    expect(resolved.layer.color).toBe("#c48b7a");
  });

  it("applies a non-defeatable overlay floor for photos and gradients", () => {
    const photo = resolveChatAppearance({
      personal: { ...image(), overlay: 0 },
      shared: noneShared,
      theme: "light",
    });
    expect(photo.readability.overlayFloor).toBe(overlayFloorFor("image", "light"));
    expect(photo.layer.overlay).toBeGreaterThan(0);

    const dark = resolveChatAppearance({
      personal: { ...image(), overlay: 0 },
      shared: noneShared,
      theme: "dark",
    });
    expect(dark.layer.overlay).toBeGreaterThan(photo.layer.overlay);

    const solidNone = resolveChatAppearance({
      personal: { ...solid(), overlay: 0 },
      shared: noneShared,
      theme: "light",
    });
    expect(solidNone.layer.overlay).toBe(0);

    const raised = resolveChatAppearance({
      personal: { ...image(), overlay: 0.8 },
      shared: noneShared,
      theme: "light",
    });
    expect(raised.layer.overlay).toBe(0.8);
  });

  it("fills a shared image asset id from wallpaper_media_id", () => {
    const assetId = "22222222-2222-4222-8222-222222222222";
    const resolved = resolveChatAppearance({
      personal: {},
      shared: shared("image", { ...defaultWallpaperConfig(), type: "image" }, assetId),
      theme: "light",
    });
    expect(resolved.source).toBe("shared");
    expect(resolved.layer.assetId).toBe(assetId);
  });
});

function appearancePayload(input: {
  personal: AppearancePayload["personal"];
  shared?: AppearancePayload["shared"];
}): AppearancePayload {
  const sharedConfig = input.shared && "type" in input.shared ? input.shared : {};
  const sharedMode = sharedConfig && "type" in sharedConfig ? sharedConfig.type : "none";
  const resolved = resolveChatAppearance({
    personal: input.personal,
    shared: {
      mode: sharedMode,
      config: sharedConfig,
    },
    theme: "light",
  });
  return {
    personal: input.personal,
    shared: (input.shared ?? {}) as AppearancePayload["shared"],
    sharedMode,
    sharedVersion: 0,
    sharedUpdatedBy: null,
    partnerName: "Tala",
    resolved,
    imageUrl: null,
  };
}

describe("wallpaper paint identity", () => {
  it("stays stable when only dim or overlay change", () => {
    const base = { ...solid(), dim: 0, overlay: 0 };
    const dimmed = { ...base, dim: 0.8, overlay: 0.5 };
    expect(wallpaperPaintKey(base)).toBe(wallpaperPaintKey(dimmed));
  });
});

describe("editor baseline vs empty personal", () => {
  it("inherits the shared look when personal is empty so Default can still apply", () => {
    const clay = solid("#c48b7a");
    const payload = appearancePayload({ personal: {}, shared: clay });
    expect(editorBaseline("personal", payload).color).toBe("#c48b7a");
    expect(editorBaseline("personal", payload)).toEqual(payload.resolved.config);
  });

  it("keeps an active type none override instead of inheriting shared", () => {
    const payload = appearancePayload({
      personal: configFromDefault(),
      shared: solid("#c48b7a"),
    });
    expect(editorBaseline("personal", payload).type).toBe("none");
  });
});
