"use client";

import type { HTMLAttributes, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { lockPageScroll } from "@/components/shhh/scroll-lock";
import { ShhhSurface } from "@/components/shhh/shhh-surface";
import { useFocusTrap } from "@/components/shhh/use-focus-trap";
import { cn } from "@/lib/utils";

export type ShhhModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
  /** Sticky bottom action area, mirroring ShhhSheet. */
  footer?: ReactNode;
};

/** Minimal accessible modal shell — Shhh-styled for future flows. */
export function ShhhModal({
  open,
  onClose,
  title,
  children,
  className,
  footer,
}: ShhhModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    return lockPageScroll();
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="shhh-modal"
    >
      <button
        type="button"
        className="shhh-sheet-backdrop absolute inset-0"
        aria-label="Close"
        data-testid="shhh-modal-backdrop"
        onClick={onClose}
      />
      <ShhhSurface
        ref={panelRef}
        tone="raised"
        round="xl"
        elevation="float"
        padding="none"
        className={cn(
          "shhh-modal-panel relative z-[1] flex max-h-[min(88dvh,44rem)] w-full max-w-md flex-col bg-sheet",
          className,
        )}
      >
        {title ? (
          <h2 className="shrink-0 px-6 pb-1 pt-6 text-xl font-bold text-primary-text">{title}</h2>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 pt-3">
          {children}
        </div>
        {footer ? (
          <div className="shrink-0 border-t border-divider/40 px-6 pb-5 pt-4">{footer}</div>
        ) : null}
      </ShhhSurface>
    </div>,
    document.body,
  );
}

const SHEET_MS = 320;
const DISMISS_PX = 100;
const DISMISS_VELOCITY = 0.55;

export type ShhhSheetProps = HTMLAttributes<HTMLDivElement> & {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Sticky bottom action area (Apply, etc.) */
  footer?: ReactNode;
};

/**
 * Soft bottom sheet: enter/exit motion, swipe-to-dismiss, scroll lock.
 * Portaled to document.body so transformed ancestors (tab panels, etc.)
 * cannot trap it under the bottom nav.
 * Stay mounted through exit so animations can finish.
 */
export function ShhhSheet({
  open,
  onClose,
  title,
  footer,
  className,
  children,
  ...props
}: ShhhSheetProps) {
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const dragStartY = useRef(0);
  const dragStartT = useRef(0);
  const lastT = useRef(0);
  const dragYRef = useRef(0);
  const exitTimer = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const requestClose = useCallback(() => {
    onCloseRef.current();
  }, []);

  useFocusTrap(panelRef, mounted && entered);

  // Intentional mount/unmount orchestration for enter/exit motion.
  /* eslint-disable react-hooks/set-state-in-effect -- sheet enter/exit keep-alive */
  useEffect(() => {
    if (open) {
      if (exitTimer.current) {
        window.clearTimeout(exitTimer.current);
        exitTimer.current = null;
      }
      setMounted(true);
      const id = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setEntered(true));
      });
      return () => window.cancelAnimationFrame(id);
    }
    setEntered(false);
    setDragY(0);
    exitTimer.current = window.setTimeout(() => {
      setMounted(false);
    }, SHEET_MS);
    return () => {
      if (exitTimer.current) {
        window.clearTimeout(exitTimer.current);
      }
    };
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    // Bind on `open`, not on `mounted`: mounting happens one commit later, and an
    // Escape pressed in that gap would be swallowed with no second chance.
    if (!open && !mounted) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted, open, requestClose]);

  useEffect(() => {
    if (!mounted) return;
    return lockPageScroll();
  }, [mounted]);

  function onHandlePointerDown(event: ReactPointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    draggingRef.current = true;
    setDragging(true);
    dragStartY.current = event.clientY;
    dragStartT.current = performance.now();
    lastT.current = performance.now();
    dragYRef.current = 0;
    setDragY(0);

    const onMove = (moveEvent: PointerEvent) => {
      if (!draggingRef.current) return;
      const dy = Math.max(0, moveEvent.clientY - dragStartY.current);
      dragYRef.current = dy;
      setDragY(dy);
      lastT.current = performance.now();
    };

    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setDragging(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      const dy = dragYRef.current;
      const elapsed = Math.max(1, lastT.current - dragStartT.current);
      const velocity = elapsed >= 48 ? dy / elapsed : 0;
      if (dy > DISMISS_PX || (dy > 48 && velocity > DISMISS_VELOCITY)) {
        requestClose();
      } else {
        dragYRef.current = 0;
        setDragY(0);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  if (!mounted || typeof document === "undefined") return null;

  const backdropOpacity = entered ? Math.max(0.15, 1 - dragY / 280) : 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title ?? "Sheet"}
      data-testid="shhh-sheet"
      data-state={entered ? "open" : "closed"}
    >
      <button
        type="button"
        className="shhh-sheet-backdrop absolute inset-0"
        style={{ opacity: backdropOpacity }}
        aria-label="Close"
        data-testid="shhh-sheet-backdrop"
        onClick={requestClose}
      />
      <ShhhSurface
        ref={panelRef}
        tone="raised"
        round="xl"
        elevation="float"
        padding="none"
        className={cn(
          "shhh-sheet-panel relative z-[1] flex max-h-[min(88dvh,40rem)] w-full max-w-lg flex-col",
          "rounded-b-none bg-sheet",
          className,
        )}
        style={{
          transform: entered ? `translateY(${dragY}px)` : "translateY(100%)",
          transition: dragging
            ? "none"
            : `transform ${SHEET_MS}ms var(--shhh-ease-settle), opacity ${SHEET_MS}ms var(--shhh-ease-settle)`,
          opacity: entered ? 1 : 0,
          paddingBottom: "calc(var(--shhh-safe-bottom) + 0.75rem)",
        }}
        {...props}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none flex-col items-center pb-1 pt-3 active:cursor-grabbing"
          data-testid="shhh-sheet-handle"
          onPointerDown={onHandlePointerDown}
        >
          <div
            className="h-1.5 w-11 rounded-pill bg-[color-mix(in_srgb,var(--shhh-text-muted)_55%,transparent)]"
            aria-hidden
          />
          {title ? (
            <h2 className="mt-3 w-full px-5 text-start text-base font-semibold text-primary-text">
              {title}
            </h2>
          ) : null}
        </div>
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-3 pt-2">
          {children}
        </div>
        {footer ? (
          <div className="shhh-sheet-footer shrink-0 border-t border-divider/40 px-5 pb-2 pt-3">
            {footer}
          </div>
        ) : null}
      </ShhhSurface>
    </div>,
    document.body,
  );
}
