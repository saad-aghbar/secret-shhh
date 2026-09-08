import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  cn(
    "shhh-press inline-flex items-center justify-center gap-2 font-semibold",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
  ),
  {
    variants: {
      variant: {
        primary:
          "bg-button text-on-button shadow-[var(--shhh-shadow-soft)] hover:bg-button-strong hover:-translate-y-px",
        secondary:
          "bg-bg-soft text-primary-text hover:bg-accent-soft/60 hover:-translate-y-px",
        ghost: "bg-transparent text-secondary-text hover:text-primary-text hover:bg-accent-soft/40",
        danger: "bg-danger/90 text-on-danger hover:bg-danger",
      },
      size: {
        sm: "min-h-10 rounded-full px-4 text-sm",
        md: "min-h-11 rounded-full px-5 text-sm",
        lg: "min-h-12 rounded-full px-6 text-base",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  },
);

export type ShhhButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function ShhhButton({
  className,
  variant,
  size,
  fullWidth,
  type = "button",
  ...props
}: ShhhButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...props}
    />
  );
}
