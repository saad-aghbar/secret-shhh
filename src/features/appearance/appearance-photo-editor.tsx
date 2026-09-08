"use client";

import { useRef } from "react";

import { ShhhButton, ShhhSlider } from "@/components/shhh";
import { useWallpaperFocalGestures } from "@/features/appearance/use-wallpaper-focal-gestures";
import { CONSUMER_APPEARANCE_ERRORS, MAX_ZOOM, MIN_ZOOM } from "@/lib/appearance/limits";
import type { WallpaperConfig } from "@/lib/appearance/config";
import { wallpaperPhotoTransform } from "@/lib/appearance/focal";
import { cn } from "@/lib/utils";

export function AppearancePhotoEditor({
  config,
  imageUrl,
  uploading,
  waiting,
  error,
  onPick,
  onChangeFocal,
  onResetFocal,
}: {
  config: WallpaperConfig;
  imageUrl: string | null;
  uploading: boolean;
  waiting: boolean;
  error: string | null;
  onPick: (file: File) => void;
  onChangeFocal: (next: { focalX: number; focalY: number; zoom: number }) => void;
  onResetFocal: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const gestures = useWallpaperFocalGestures(config, onChangeFocal);

  return (
    <div data-testid="appearance-photo-editor" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-primary-text text-sm font-semibold">Photo</p>
        <ShhhButton
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          Choose photo
        </ShhhButton>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif,.png,.jpg,.jpeg,.webp,.gif,.avif,.bmp"
        className="sr-only"
        data-testid="appearance-photo-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onPick(file);
        }}
      />
      <div
        data-testid="appearance-photo-crop"
        className={cn(
          "bg-bg-soft relative mx-auto aspect-[4/5] w-full max-w-[22rem] overflow-hidden rounded-[1.4rem]",
          "cursor-grab touch-none shadow-[var(--shhh-shadow-soft)] [clip-path:inset(0_round_1.4rem)]",
          "active:cursor-grabbing",
        )}
        aria-label="Move and zoom photo"
        {...(imageUrl ? gestures : {})}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            data-testid="appearance-photo-image"
            draggable={false}
            className="pointer-events-none absolute inset-0 size-full object-cover select-none"
            style={{
              transform: wallpaperPhotoTransform(config.focalX, config.focalY, config.zoom),
              transformOrigin: "center",
            }}
          />
        ) : (
          <p className="text-secondary-text absolute inset-0 grid place-items-center px-6 text-center text-sm">
            {waiting
              ? CONSUMER_APPEARANCE_ERRORS.WAITING
              : uploading
                ? "Saving photo…"
                : "Pick a photo from your library."}
          </p>
        )}
      </div>
      {imageUrl ? (
        <>
          <p className="text-secondary-text text-center text-sm">
            Drag to move · pinch or zoom to find the spot
          </p>
          <label className="flex flex-col gap-2">
            <span className="text-primary-text text-sm font-semibold">Zoom</span>
            <ShhhSlider
              label="Zoom"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={config.zoom}
              data-testid="appearance-slider-zoom"
              onChange={(event) =>
                onChangeFocal({
                  focalX: config.focalX,
                  focalY: config.focalY,
                  zoom: Number(event.target.value),
                })
              }
            />
          </label>
          <button
            type="button"
            className="text-accent text-sm font-semibold"
            onClick={onResetFocal}
            data-testid="appearance-photo-reset"
          >
            Reset position
          </button>
        </>
      ) : null}
      {error ? <p className="text-danger text-sm">{error}</p> : null}
      {waiting ? (
        <p className="text-secondary-text text-sm" data-testid="appearance-waiting">
          {CONSUMER_APPEARANCE_ERRORS.WAITING}
        </p>
      ) : null}
    </div>
  );
}
