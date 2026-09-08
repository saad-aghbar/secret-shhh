"use client";

import { Camera, Images, Music2, Pencil } from "lucide-react";
import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import { ShhhSheet } from "@/components/shhh";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/utils";

type MediaAttachSheetProps = {
  open: boolean;
  onClose: () => void;
  onSelectFiles: (files: File[]) => void;
  onOpenCamera: () => void;
  onOpenDoodle?: () => void;
  onOpenMusic?: () => void;
  cameraSupported: boolean;
  /** Anchor for desktop floating popover (the + button). */
  anchorRef?: RefObject<HTMLElement | null>;
};

function Row({
  testId,
  label,
  hint,
  tone,
  icon,
  onClick,
}: {
  testId: string;
  label: string;
  hint: string;
  tone: "accent" | "love";
  icon: ReactNode;
  onClick: () => void;
}) {
  const glyph =
    tone === "love" ? "bg-love-soft text-primary-text" : "bg-accent-soft text-accent-strong";
  return (
    <button
      type="button"
      data-testid={testId}
      className={cn(
        "shhh-press bg-bg-soft text-primary-text flex min-h-[4.75rem] w-full items-center gap-3.5 rounded-[1.7rem] px-3.5 py-3 text-start",
        tone === "love" ? "hover:bg-love-soft/50" : "hover:bg-accent-soft/40",
      )}
      onClick={onClick}
    >
      <span
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-full shadow-[var(--shhh-shadow-soft)]",
          glyph,
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="text-muted-text mt-0.5 block text-xs font-normal">{hint}</span>
      </span>
    </button>
  );
}

/**
 * Soft attachment chooser — Media (library) and Camera.
 * Mobile: ShhhSheet. Desktop (sm+): floating bubble near +.
 */
export function MediaAttachSheet({
  open,
  onClose,
  onSelectFiles,
  onOpenCamera,
  onOpenDoodle,
  onOpenMusic,
  cameraSupported,
  anchorRef,
}: MediaAttachSheetProps) {
  const mediaRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLInputElement>(null);
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    if (!open || !isDesktop) return;

    function place() {
      const node = anchorRef?.current;
      if (!node) {
        setPanelStyle({ left: 24, bottom: 96, width: 300 });
        return;
      }
      const rect = node.getBoundingClientRect();
      const width = Math.min(300, window.innerWidth - 24);
      const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
      const bottom = Math.max(24, window.innerHeight - rect.top + 10);
      setPanelStyle({ left, bottom, width });
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, isDesktop, onClose, anchorRef]);

  function takeFiles(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (files.length) {
      onSelectFiles(files);
      onClose();
    }
  }

  const rows = (
    <div className="flex flex-col gap-2.5">
      <Row
        testId="media-pick-library"
        label="Media"
        hint="Choose photos or videos"
        tone="accent"
        icon={<Images className="size-5" strokeWidth={2} />}
        onClick={() => mediaRef.current?.click()}
      />
      <Row
        testId="media-pick-camera"
        label="Camera"
        hint="Tap for photo · Hold for video"
        tone="love"
        icon={<Camera className="size-5" strokeWidth={2} />}
        onClick={() => {
          if (cameraSupported) {
            onClose();
            onOpenCamera();
            return;
          }
          captureRef.current?.click();
        }}
      />
      {onOpenMusic ? (
        <Row
          testId="media-pick-music"
          label="Music"
          hint="Send a song or a clip"
          tone="love"
          icon={<Music2 className="size-5" strokeWidth={2} />}
          onClick={() => {
            onClose();
            onOpenMusic();
          }}
        />
      ) : null}
      {onOpenDoodle ? (
        <Row
          testId="media-pick-doodle"
          label="Doodle"
          hint="Draw something for them"
          tone="accent"
          icon={<Pencil className="size-5" strokeWidth={2} />}
          onClick={() => {
            onClose();
            onOpenDoodle();
          }}
        />
      ) : null}
    </div>
  );

  const inputs = (
    <>
      <input
        ref={mediaRef}
        data-testid="media-input"
        className="sr-only"
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={(event) => {
          takeFiles(event.target.files);
          event.target.value = "";
        }}
      />
      {cameraSupported ? null : (
        <input
          ref={captureRef}
          data-testid="media-capture-input"
          className="sr-only"
          type="file"
          accept="image/*,video/*"
          capture="environment"
          onChange={(event) => {
            takeFiles(event.target.files);
            event.target.value = "";
          }}
        />
      )}
    </>
  );

  const desktopPanel =
    typeof document !== "undefined" && isDesktop && open
      ? createPortal(
          <div className="fixed inset-0 z-[70]" data-testid="attach-sheet-desktop">
            <button
              type="button"
              className="absolute inset-0 bg-[color-mix(in_srgb,var(--shhh-overlay)_45%,transparent)]"
              aria-label="Close"
              onClick={onClose}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Add"
              style={panelStyle}
              className={cn(
                "animate-shhh-settle absolute z-[1] rounded-[1.75rem]",
                "bg-sheet p-4 shadow-[var(--shhh-shadow-float)]",
                "motion-reduce:animate-none",
              )}
            >
              <p className="text-primary-text mb-3 px-1 text-sm font-semibold">Add</p>
              {rows}
              {inputs}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {isDesktop ? (
        <>
          {desktopPanel}
          {!open ? inputs : null}
        </>
      ) : (
        <>
          <ShhhSheet open={open} onClose={onClose} title="Add">
            <div className="pb-1">{rows}</div>
          </ShhhSheet>
          {inputs}
        </>
      )}
    </>
  );
}
