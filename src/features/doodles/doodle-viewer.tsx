"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";

import { lockPageScroll } from "@/components/shhh/scroll-lock";
import { useFocusTrap } from "@/components/shhh/use-focus-trap";
import { DoodleArt } from "@/features/doodles/doodle-art";
import { formatMessageTime } from "@/lib/chat/layout";
import type { DoodleRef } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

type DoodleViewerProps = {
  open: boolean;
  doodle: DoodleRef | null;
  senderName?: string;
  timestamp?: string;
  onClose: () => void;
};

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function DoodleViewer({ open, doodle, senderName, timestamp, onClose }: DoodleViewerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ y: number; pointerId: number } | null>(null);
  const [dragY, setDragY] = useState(0);
  const reduced = prefersReducedMotion();

  useFocusTrap(rootRef, open);

  useEffect(() => {
    if (!open) return;
    return lockPageScroll();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !doodle || typeof document === "undefined") return null;

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (reduced) return;
    start.current = { y: event.clientY, pointerId: event.pointerId };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!start.current || start.current.pointerId !== event.pointerId) return;
    setDragY(Math.max(0, event.clientY - start.current.y));
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!start.current || start.current.pointerId !== event.pointerId) return;
    const distance = Math.max(0, event.clientY - start.current.y);
    start.current = null;
    if (distance > 96) {
      onClose();
    }
    setDragY(0);
  }

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Doodle"
      data-testid="doodle-viewer"
      className={cn(
        "fixed inset-0 z-[100] flex flex-col bg-[var(--shhh-viewer-ink)]",
        !reduced && "animate-shhh-viewer-enter",
      )}
      style={{
        opacity: dragY > 0 ? Math.max(0.55, 1 - dragY / 420) : 1,
        transform: dragY > 0 ? `translateY(${Math.round(dragY * 0.9)}px)` : undefined,
      }}
    >
      <header className="relative z-20 flex items-center justify-between gap-3 px-3 pt-[calc(var(--shhh-safe-top)+0.65rem)] pb-2">
        <div className="min-w-0 rounded-full bg-[rgb(247_241_232_/0.14)] px-3.5 py-2 shadow-[0_8px_28px_rgb(0_0_0_/0.22)] backdrop-blur-md">
          <p className="truncate text-sm font-semibold text-[var(--shhh-viewer-ivory)]">
            {senderName || "Doodle"}
            {timestamp ? (
              <span className="font-medium text-[var(--shhh-viewer-ivory)]/70">
                {" "}
                · {formatMessageTime(timestamp)}
              </span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close doodle"
          data-testid="doodle-viewer-close"
          className="shhh-press grid size-11 place-items-center rounded-full bg-[rgb(247_241_232_/0.16)] text-[var(--shhh-viewer-ivory)] shadow-[0_8px_28px_rgb(0_0_0_/0.22)] backdrop-blur-md"
          onClick={onClose}
        >
          <X className="size-5" strokeWidth={2.2} />
        </button>
      </header>

      <div
        className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-4 pb-[calc(var(--shhh-safe-bottom)+1.4rem)] sm:px-8"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          start.current = null;
          setDragY(0);
        }}
      >
        <div className="shhh-doodle-paper-float aspect-[4/5] w-full max-w-[min(26rem,88vw)] overflow-hidden rounded-[1.75rem] sm:max-w-[22rem] md:max-w-[24rem]">
          <DoodleArt
            document={doodle.document}
            label={`Doodle sent by ${senderName || "someone"}`}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
