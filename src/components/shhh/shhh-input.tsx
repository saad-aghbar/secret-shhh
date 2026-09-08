import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type ShhhInputProps = InputHTMLAttributes<HTMLInputElement>;

export function ShhhInput({ className, ...props }: ShhhInputProps) {
  return (
    <input
      className={cn(
        "w-full min-h-11 rounded-xl border border-divider bg-input-surface px-4 py-2.5 text-primary-text",
        "outline-none transition",
        "placeholder:text-muted-text",
        "focus:border-accent focus:bg-composer focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--shhh-accent)_20%,transparent)]",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
