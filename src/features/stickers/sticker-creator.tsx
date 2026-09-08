"use client";

import { RotateCw, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { ShhhButton, ShhhIconButton } from "@/components/shhh";
import { isAnimatedStickerSource } from "@/lib/stickers/animated";
import {
  closeImageBitmap,
  encodeStickerCanvas,
  revokeObjectUrl,
} from "@/lib/stickers/encode";
import { sha256Hex } from "@/lib/media/checksum";
import { apiCreateSticker } from "@/lib/stickers/client-api";
import type { StickerListItem } from "@/lib/stickers/types";
import { STICKER_CANVAS_SIZE } from "@/lib/stickers/validation";
import { cn } from "@/lib/utils";

type StickerCreatorProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (sticker: StickerListItem) => void;
};

export function StickerCreator({ open, onClose, onCreated }: StickerCreatorProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [animated, setAnimated] = useState(false);
  const [name, setName] = useState("");
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pinch = useRef<{ distance: number; scale: number } | null>(null);

  const resetTransform = useCallback(() => {
    setScale(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  }, []);

  const clearSource = useCallback(() => {
    revokeObjectUrl(previewUrl);
    closeImageBitmap(bitmap);
    setFile(null);
    setPreviewUrl(null);
    setBitmap(null);
    setAnimated(false);
    setName("");
    setError(null);
    resetTransform();
  }, [bitmap, previewUrl, resetTransform]);

  async function takeFile(next: File | null) {
    clearSource();
    if (!next) return;
    const bytes = new Uint8Array(await next.slice(0, 256 * 1024).arrayBuffer());
    const isAnimated = isAnimatedStickerSource(bytes);
    const url = URL.createObjectURL(next);
    setFile(next);
    setPreviewUrl(url);
    setAnimated(isAnimated);
    if (!isAnimated) {
      try {
        setBitmap(await createImageBitmap(next));
      } catch {
        setError("Couldn't open that image.");
      }
    }
  }

  function pointerDistance(event: React.TouchEvent | TouchEvent) {
    if (event.touches.length < 2) return 0;
    const a = event.touches[0]!;
    const b = event.touches[1]!;
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  async function save() {
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      let blob: Blob = file;
      let mimeAnimated = animated;
      let width = STICKER_CANVAS_SIZE;
      let height = STICKER_CANVAS_SIZE;
      if (animated) {
        width = bitmap?.width || 512;
        height = bitmap?.height || 512;
        if (previewUrl) {
          const img = new Image();
          img.src = previewUrl;
          await img.decode().catch(() => undefined);
          width = img.naturalWidth || width;
          height = img.naturalHeight || height;
        }
      } else if (bitmap) {
        const encoded = await encodeStickerCanvas(bitmap, {
          scale,
          rotationDeg: rotation,
          panX: pan.x,
          panY: pan.y,
        });
        blob = encoded.blob;
        width = encoded.width;
        height = encoded.height;
        mimeAnimated = false;
      }
      const sticker = await apiCreateSticker({
        id: crypto.randomUUID(),
        file: blob,
        name: name.trim() || null,
        animated: mimeAnimated,
        width,
        height,
        checksum: await sha256Hex(blob),
      });
      onCreated(sticker);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that sticker.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="bg-surface-elevated flex min-h-[18rem] flex-col"
      data-testid="sticker-creator"
    >
      <header className="flex shrink-0 items-center justify-between gap-2 px-1 pt-1 pb-2 sm:px-2">
        <p className="text-primary-text text-sm font-semibold">New sticker</p>
        <ShhhIconButton
          type="button"
          label="Close creator"
          onClick={() => {
            clearSource();
            onClose();
          }}
          className="size-10"
        >
          <X className="size-4" strokeWidth={2.2} />
        </ShhhIconButton>
      </header>

      {!file ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-8">
          <p className="text-secondary-text mb-4 max-w-xs text-center text-sm leading-relaxed">
            Pick a photo from your library. We’ll keep the transparent bits.
          </p>
          <ShhhButton type="button" onClick={() => fileRef.current?.click()} data-testid="sticker-pick">
            Choose image
          </ShhhButton>
        </div>
      ) : (
        <>
          <div className="flex flex-col px-1 sm:px-2">
            <div
              ref={stageRef}
              data-testid="sticker-workspace"
              className={cn(
                "relative mx-auto aspect-square w-full min-h-[10rem] max-w-[16rem] overflow-hidden rounded-[1.75rem] sm:max-w-[20rem]",
                "shadow-[var(--shhh-shadow-soft)]",
                animated ? "bg-bg-soft" : "sticker-checkered",
              )}
              onPointerDown={(event) => {
                if (animated) return;
                drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (!drag.current || animated) return;
                setPan({
                  x: drag.current.panX + (event.clientX - drag.current.x),
                  y: drag.current.panY + (event.clientY - drag.current.y),
                });
              }}
              onPointerUp={() => {
                drag.current = null;
              }}
              onWheel={(event) => {
                if (animated) return;
                event.preventDefault();
                setScale((current) => Math.min(3, Math.max(0.4, current + (event.deltaY > 0 ? -0.08 : 0.08))));
              }}
              onTouchStart={(event) => {
                if (animated || event.touches.length !== 2) return;
                pinch.current = { distance: pointerDistance(event), scale };
              }}
              onTouchMove={(event) => {
                if (!pinch.current || event.touches.length !== 2) return;
                const next = pointerDistance(event);
                if (!pinch.current.distance) return;
                setScale(
                  Math.min(3, Math.max(0.4, pinch.current.scale * (next / pinch.current.distance))),
                );
              }}
              onTouchEnd={() => {
                pinch.current = null;
              }}
            >
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute inset-0 m-auto max-h-none max-w-none select-none object-contain"
                  style={
                    animated
                      ? { width: "100%", height: "100%" }
                      : {
                          width: "100%",
                          height: "100%",
                          transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${scale})`,
                        }
                  }
                />
              ) : null}
              {animated ? (
                <p className="text-muted-text absolute inset-x-3 bottom-3 rounded-pill bg-[color-mix(in_srgb,var(--shhh-surface)_80%,transparent)] px-3 py-1 text-center text-[11px] font-medium">
                  Animation stays as-is — just a frame to crop later.
                </p>
              ) : null}
            </div>

            {!animated ? (
              <div
                className="bg-surface-floating mx-auto mt-2 w-full max-w-[16rem] rounded-[1.35rem] px-3 py-2.5 shadow-[var(--shhh-shadow-soft)] sm:max-w-[20rem] sm:px-4"
                data-testid="sticker-controls"
              >
                <label className="text-secondary-text flex items-center gap-3 text-[12px] font-medium">
                  Size
                  <input
                    type="range"
                    min={0.4}
                    max={3}
                    step={0.05}
                    value={scale}
                    onChange={(event) => setScale(Number(event.target.value))}
                    className="flex-1"
                    aria-label="Scale"
                  />
                </label>
                <label className="text-secondary-text mt-2 flex items-center gap-3 text-[12px] font-medium">
                  Tilt
                  <input
                    type="range"
                    min={-45}
                    max={45}
                    step={1}
                    value={((rotation % 360) + 360) % 360 > 180 ? rotation : rotation}
                    onChange={(event) => setRotation(Number(event.target.value))}
                    className="flex-1"
                    aria-label="Fine rotate"
                  />
                  <ShhhIconButton
                    type="button"
                    label="Rotate 90 degrees"
                    className="size-9"
                    onClick={() => setRotation((current) => current + 90)}
                  >
                    <RotateCw className="size-4" strokeWidth={2.1} />
                  </ShhhIconButton>
                </label>
                <button
                  type="button"
                  className="text-accent mt-2 text-[12px] font-semibold"
                  onClick={resetTransform}
                >
                  Reset
                </button>
              </div>
            ) : null}

            <div className="mx-auto mt-2 grid w-full max-w-[16rem] grid-cols-2 gap-2 sm:max-w-[20rem]">
              <div className="sticker-checkered-light h-11 overflow-hidden rounded-[1rem] sm:h-14">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="" className="size-full object-contain" />
                ) : null}
              </div>
              <div className="sticker-checkered-dark h-11 overflow-hidden rounded-[1rem] sm:h-14">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="" className="size-full object-contain" />
                ) : null}
              </div>
            </div>

            <label className="mx-auto mt-2 block w-full max-w-[16rem] sm:max-w-[20rem]">
              <span className="sr-only">Sticker name</span>
              <input
                dir="auto"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Optional name"
                data-testid="sticker-name"
                className="bg-bg-soft text-primary-text placeholder:text-muted-text w-full rounded-pill px-4 py-2.5 text-sm outline-none [unicode-bidi:plaintext]"
              />
            </label>
            {error ? (
              <p className="text-danger mx-auto mt-2 max-w-[20rem] text-center text-[12px]">{error}</p>
            ) : null}
          </div>

          <footer className="bg-surface-elevated sticky bottom-0 z-[1] mt-2 flex shrink-0 items-center justify-end gap-2 px-1 pt-2 pb-1 sm:px-2">
            <ShhhButton
              type="button"
              variant="ghost"
              onClick={() => {
                clearSource();
                onClose();
              }}
            >
              Cancel
            </ShhhButton>
            <ShhhButton
              type="button"
              data-testid="sticker-save"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? "Saving…" : "Save"}
            </ShhhButton>
          </footer>
        </>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        data-testid="sticker-file"
        onChange={(event) => {
          void takeFile(event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
      />
    </div>
  );
}
