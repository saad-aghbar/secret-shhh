import type { HTMLAttributes } from "react";

import { ShhhSurface } from "@/components/shhh/shhh-surface";
import { cn } from "@/lib/utils";

export type ShhhCardProps = HTMLAttributes<HTMLDivElement> & {
  title?: string;
  description?: string;
};

/** Soft grouped section — solid raised surface, not a glass dashboard card. */
export function ShhhCard({ className, title, description, children, ...props }: ShhhCardProps) {
  return (
    <ShhhSurface
      tone="raised"
      round="lg"
      elevation="soft"
      padding="lg"
      className={cn(className)}
      {...props}
    >
      {title ? <h2 className="text-sm font-semibold text-primary-text">{title}</h2> : null}
      {description ? (
        <p className={cn("text-sm text-secondary-text", title && "mt-1")}>{description}</p>
      ) : null}
      {children ? <div className={cn((title || description) && "mt-4")}>{children}</div> : null}
    </ShhhSurface>
  );
}
