import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type ShhhAvatarProps = HTMLAttributes<HTMLDivElement> & {
  initials?: string;
  src?: string | null;
  alt?: string;
  size?: "sm" | "md" | "lg" | "xl";
  ring?: boolean;
  highlighted?: boolean;
};

const sizes = {
  sm: "size-10 text-sm",
  md: "size-14 text-base",
  lg: "size-16 text-xl",
  xl: "size-20 text-2xl",
} as const;

export function ShhhAvatar({
  className,
  initials = "?",
  src,
  alt = "",
  size = "md",
  ring = false,
  highlighted = false,
  ...props
}: ShhhAvatarProps) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        "bg-accent-soft font-bold text-accent shadow-[var(--shhh-shadow-soft)]",
        sizes[size],
        ring && "ring-2 ring-accent/30 ring-offset-2 ring-offset-background",
        highlighted && "identity-ring",
        className,
      )}
      {...props}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- photo URLs are user-controlled later
        <img src={src} alt={alt} className="size-full object-cover" />
      ) : (
        <span aria-hidden>{initials.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}
