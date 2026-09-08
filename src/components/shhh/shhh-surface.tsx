import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, Ref } from "react";

import { cn } from "@/lib/utils";

const surfaceVariants = cva("relative", {
  variants: {
    tone: {
      raised: "bg-surface-elevated",
      soft: "bg-surface",
      floating: "bg-surface-elevated/95 backdrop-blur-md",
      glass: "bg-surface-elevated/90 backdrop-blur-md",
      inset: "bg-bg-soft",
    },
    padding: {
      none: "p-0",
      sm: "p-3",
      md: "p-4",
      lg: "p-5",
    },
    elevation: {
      none: "",
      soft: "shadow-[var(--shhh-shadow-soft)]",
      float: "shadow-[var(--shhh-shadow-float)]",
    },
    round: {
      md: "rounded-[var(--shhh-radius-md)]",
      lg: "rounded-[var(--shhh-radius-lg)]",
      xl: "rounded-[var(--shhh-radius-xl)]",
      pill: "rounded-full",
      bubble: "rounded-[var(--shhh-radius-lg)]",
    },
  },
  defaultVariants: {
    tone: "raised",
    padding: "md",
    elevation: "soft",
    round: "lg",
  },
});

export type ShhhSurfaceProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof surfaceVariants> & { ref?: Ref<HTMLDivElement> };

export function ShhhSurface({
  className,
  tone,
  padding,
  elevation,
  round,
  ...props
}: ShhhSurfaceProps) {
  return (
    <div
      className={cn(surfaceVariants({ tone, padding, elevation, round }), className)}
      {...props}
    />
  );
}
