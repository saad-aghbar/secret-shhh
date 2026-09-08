"use client";

import type { ReactNode } from "react";
import { useId, useState } from "react";

import { cn } from "@/lib/utils";

export type ShhhTooltipProps = {
  content: string;
  children: ReactNode;
  className?: string;
};

/** Lightweight tooltip shell for future use. */
export function ShhhTooltip({ content, children, className }: ShhhTooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined}>{children}</span>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded-pill bg-surface-elevated px-3 py-1.5 text-xs text-primary-text shadow-[var(--shhh-shadow-soft)]"
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
