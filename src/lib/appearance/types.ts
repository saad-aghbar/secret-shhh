import type { ResolvedAppearance, WallpaperConfig, WallpaperType } from "@/lib/appearance/config";

export type AppearancePayload = {
  personal: WallpaperConfig | Record<string, never>;
  shared: WallpaperConfig | Record<string, never>;
  sharedMode: WallpaperType;
  sharedVersion: number;
  sharedUpdatedBy: string | null;
  partnerName: string;
  resolved: ResolvedAppearance;
  imageUrl: string | null;
};

export type WallpaperReadUrl = {
  url: string;
  expiresAt: string;
  assetId: string;
};

export type WallpaperUploadInit = {
  assetId: string;
  storageKey: string;
  upload: {
    url: string;
    method: "PUT";
    headers: Record<string, string>;
    expiresAt: string;
  };
};
