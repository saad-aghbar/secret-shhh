"use client";

import { useEffect, useState, type CSSProperties } from "react";

import { appearanceCssVars } from "@/lib/appearance/css";
import {
  wallpaperPaintKey,
  type AppearanceTheme,
  type ResolvedAppearance,
} from "@/lib/appearance/config";
import { getSignedWallpaperUrl } from "@/lib/appearance/signed-url-cache";
import { cn } from "@/lib/utils";

type WallpaperStack = {
  paintKey: string;
  hash: string;
  resolved: ResolvedAppearance;
  imageUrl: string | null;
};

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return reduced;
}

export function WallpaperLayer({
  resolved,
  imageUrl = null,
  theme = "light",
  className,
}: {
  resolved: ResolvedAppearance;
  imageUrl?: string | null;
  theme?: AppearanceTheme;
  className?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const assetId = resolved.layer.type === "image" ? resolved.layer.assetId : undefined;
  const [fetchedUrl, setFetchedUrl] = useState<string | null>(null);
  const [current, setCurrent] = useState<WallpaperStack>({
    paintKey: wallpaperPaintKey(resolved.layer, imageUrl),
    hash: resolved.hash,
    resolved,
    imageUrl,
  });
  const [previous, setPrevious] = useState<WallpaperStack | null>(null);

  useEffect(() => {
    if (!assetId || imageUrl) return;
    let active = true;
    void getSignedWallpaperUrl(assetId)
      .then((url) => {
        if (active) setFetchedUrl(url);
      })
      .catch(() => {
        if (active) setFetchedUrl(null);
      });
    return () => {
      active = false;
    };
  }, [assetId, imageUrl]);

  const nextImage = resolved.layer.type === "image" ? (imageUrl ?? fetchedUrl) : null;
  const nextPaintKey = wallpaperPaintKey(resolved.layer, nextImage);
  const nextHash = `${resolved.hash}|${nextImage ?? ""}`;

  /* eslint-disable react-hooks/set-state-in-effect -- dual-layer crossfade keep-alive */
  useEffect(() => {
    setCurrent((existing) => {
      if (existing.hash === nextHash) return existing;
      const nextStack = { paintKey: nextPaintKey, hash: nextHash, resolved, imageUrl: nextImage };
      if (existing.paintKey === nextPaintKey) return nextStack;
      if (!reducedMotion) setPrevious(existing);
      return nextStack;
    });
  }, [nextHash, nextImage, nextPaintKey, reducedMotion, resolved]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!previous || reducedMotion) return;
    const id = window.setTimeout(() => setPrevious(null), 420);
    return () => window.clearTimeout(id);
  }, [previous, reducedMotion]);

  const stacks = previous ? [previous, current] : [current];

  return (
    <div
      className={cn(
        "shhh-wallpaper-layer pointer-events-none absolute inset-0 z-0 overflow-hidden",
        className,
      )}
      data-testid="wallpaper-layer"
      data-source={resolved.source}
      data-type={resolved.layer.type}
      data-wallpaper-active={resolved.layer.type === "none" ? "false" : "true"}
      aria-hidden
    >
      {stacks.map((stack, index) => {
        const vars = appearanceCssVars(stack.resolved, theme);
        const fading = Boolean(previous) && index === 0;
        return (
          <div
            key={stack.paintKey}
            className={cn(
              "shhh-wallpaper-stack absolute inset-0",
              fading ? "shhh-wallpaper-stack-exit" : "shhh-wallpaper-stack-enter",
            )}
            style={vars as CSSProperties}
            data-hash={stack.hash}
            data-paint={stack.paintKey}
          >
            <div
              className="shhh-wallpaper-base"
              data-type={stack.resolved.layer.type}
              style={
                {
                  "--shhh-wallpaper-image": stack.imageUrl ? `url("${stack.imageUrl}")` : "none",
                } as CSSProperties
              }
            />
            <div className="shhh-wallpaper-wash" data-testid="wallpaper-wash">
              <div className="shhh-wallpaper-dim" data-testid="wallpaper-dim" />
              <div className="shhh-wallpaper-overlay" data-testid="wallpaper-overlay" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
