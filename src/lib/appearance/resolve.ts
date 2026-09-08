import {
  appearanceHash,
  defaultWallpaperConfig,
  type AppearanceSource,
  type AppearanceTheme,
  type ResolvedAppearance,
  type WallpaperConfig,
  type WallpaperType,
} from "@/lib/appearance/config";
import { parsePersonalOverride, parseWallpaperConfigLoose } from "@/lib/appearance/validation";

export type SharedWallpaperInput = {
  mode: WallpaperType;
  config: unknown;
  mediaId?: string | null;
};

export type ResolveAppearanceInput = {
  personal: unknown;
  shared: SharedWallpaperInput;
  theme: AppearanceTheme;
};

export function overlayFloorFor(type: WallpaperType, theme: AppearanceTheme): number {
  if (type === "none" || type === "solid") return 0;
  if (type === "gradient") return theme === "dark" ? 0.1 : 0.08;
  return theme === "dark" ? 0.16 : 0.12;
}

function sharedConfigFrom(shared: SharedWallpaperInput): WallpaperConfig | null {
  if (shared.mode === "none") return null;
  const parsed = parseWallpaperConfigLoose(shared.config);
  if (parsed && parsed.type === shared.mode) {
    if (shared.mode === "image" && shared.mediaId && !parsed.assetId) {
      return { ...parsed, assetId: shared.mediaId };
    }
    return parsed;
  }
  if (shared.mode === "image" && shared.mediaId) {
    return { ...defaultWallpaperConfig(), type: "image", assetId: shared.mediaId };
  }
  return null;
}

export function resolveChatAppearance(input: ResolveAppearanceInput): ResolvedAppearance {
  const personal = parsePersonalOverride(input.personal);
  const shared = sharedConfigFrom(input.shared);

  let source: AppearanceSource = "default";
  let config = defaultWallpaperConfig();

  if (personal) {
    source = "personal";
    config = personal;
  } else if (shared) {
    source = "shared";
    config = shared;
  }

  const overlayFloor = overlayFloorFor(config.type, input.theme);
  const userOverlay = config.overlay;
  const effectiveOverlay = Math.max(userOverlay, overlayFloor);

  const layer = {
    type: config.type,
    color: config.color,
    gradient: config.gradient,
    assetId: config.assetId,
    blur: config.blur,
    dim: config.dim,
    overlay: effectiveOverlay,
    focalX: config.focalX,
    focalY: config.focalY,
    zoom: config.zoom,
  };

  return {
    source,
    config,
    layer,
    readability: {
      overlayFloor,
      userOverlay,
      effectiveOverlay,
    },
    hash: appearanceHash(layer),
  };
}
