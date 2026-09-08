"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { useFocusTrap } from "@/components/shhh/use-focus-trap";
import { cn } from "@/lib/utils";

export type PopoverAnchor = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type PopoverAlign = "start" | "center" | "end";

type ShhhPopoverProps = {
  open: boolean;
  onClose: () => void;
  anchor: PopoverAnchor | null;
  children: ReactNode;
  label: string;
  className?: string;
  testId?: string;
  align?: PopoverAlign;
  role?: string;
  dim?: boolean;
  bare?: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function alignedLeft(anchor: PopoverAnchor, panelWidth: number, align: PopoverAlign) {
  if (align === "start") return anchor.left;
  if (align === "end") return anchor.left + anchor.width - panelWidth;
  return anchor.left + anchor.width / 2 - panelWidth / 2;
}

export function ShhhPopover({
  open,
  onClose,
  anchor,
  children,
  label,
  className,
  testId = "shhh-popover",
  align = "center",
  role = "menu",
  dim = false,
  bare = false,
}: ShhhPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });
  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) return;
    const openedAt = Date.now();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onPointer = (event: PointerEvent) => {
      if (Date.now() - openedAt < 250) return;
      const node = panelRef.current;
      if (!node) return;
      const path = event.composedPath();
      if (path.includes(node)) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, [open, onClose]);

  useLayoutEffect(() => {
    if (!open || !anchor || !panelRef.current) return;
    const panel = panelRef.current.getBoundingClientRect();
    const gap = 8;
    const preferBelow = anchor.top + anchor.height + gap + panel.height <= window.innerHeight - 12;
    const top = preferBelow ? anchor.top + anchor.height + gap : anchor.top - panel.height - gap;
    const left = clamp(
      alignedLeft(anchor, panel.width, align),
      12,
      window.innerWidth - panel.width - 12,
    );
    setStyle({
      top: clamp(top, 12, window.innerHeight - panel.height - 12),
      left,
      visibility: "visible",
    });
  }, [align, anchor, open, children]);

  if (!open || !anchor || typeof document === "undefined") return null;

  return createPortal(
    <>
      {dim ? (
        <button
          type="button"
          aria-label="Close"
          data-testid="shhh-popover-backdrop"
          className="shhh-sheet-backdrop fixed inset-0 z-[65]"
          onClick={onClose}
        />
      ) : null}
      <div
        ref={panelRef}
        role={role}
        aria-modal={role === "dialog" ? true : undefined}
        aria-label={label}
        data-testid={testId}
        style={style}
        className={cn(
          "fixed z-[70] min-w-[13.5rem] rounded-[1.5rem]",
          !bare && "bg-sheet p-1.5 shadow-[var(--shhh-shadow-float)]",
          className,
        )}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
