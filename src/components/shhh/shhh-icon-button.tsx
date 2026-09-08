import type { ButtonHTMLAttributes } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export type ShhhIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
};

export const ShhhIconButton = forwardRef<HTMLButtonElement, ShhhIconButtonProps>(
  function ShhhIconButton({ className, label, type = "button", children, ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        className={cn(
          "shhh-press inline-flex size-11 items-center justify-center rounded-full",
          "bg-surface-elevated text-primary-text shadow-[var(--shhh-shadow-soft)]",
          "hover:-translate-y-px hover:bg-accent-soft/50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)]",
          "disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
