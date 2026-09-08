"use client";

import { useEffect, useRef, useState } from "react";

import { useNearViewport } from "@/features/chat/use-near-viewport";
import { getSignedStickerUrl } from "@/lib/stickers/signed-url-cache";
import { cn } from "@/lib/utils";

type StickerImageProps = {
  stickerId: string;
  name?: string | null;
  animated?: boolean;
  className?: string;
  priority?: boolean;
};

export function StickerImage({
  stickerId,
  name,
  animated = false,
  className,
  priority = false,
}: StickerImageProps) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const near = useNearViewport(frameRef, { enabled: !priority });

  useEffect(() => {
    if (!near) return;
    let active = true;
    void getSignedStickerUrl(stickerId)
      .then((url) => {
        if (active) {
          setSrc(url);
          setFailed(false);
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [near, retryKey, stickerId]);

  return (
    <div ref={frameRef} className={cn("relative overflow-hidden", className)}>
      {src && !failed ? (
        // Animated GIF/WebP must stay on <img> so frames keep playing.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name?.trim() ? name : "Sticker"}
          className="size-full object-contain"
          draggable={false}
          data-animated={animated ? "true" : undefined}
        />
      ) : failed ? (
        <button
          type="button"
          className="text-muted-text grid size-full place-items-center text-[11px]"
          onClick={() => {
            setFailed(false);
            setRetryKey((key) => key + 1);
          }}
        >
          Tap to retry
        </button>
      ) : (
        <span className="animate-shhh-breathe bg-bg-soft/80 absolute inset-0 motion-reduce:animate-none" />
      )}
    </div>
  );
}
