import type { CSSProperties } from "react";

import { themeTokenVars } from "@/lib/theme/css";
import type { ThemeTokens } from "@/lib/theme/config";
import { isLightColor } from "@/lib/theme/contrast";
import { cn } from "@/lib/utils";

export function ThemeMiniPreview({
  tokens,
  className,
  radius = "1.15rem",
  frame,
}: {
  tokens: ThemeTokens;
  className?: string;
  radius?: string;
  frame?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative overflow-hidden",
        frame ? "shadow-none" : "shadow-[var(--shhh-shadow-soft)]",
        className,
      )}
      style={
        {
          ...themeTokenVars(tokens),
          background: "var(--shhh-bg)",
          borderRadius: radius,
          clipPath: `inset(0 round ${radius})`,
          boxShadow: frame ? `inset 0 0 0 2px ${frame}` : undefined,
          colorScheme: isLightColor(tokens.bg) ? "light" : "dark",
        } as CSSProperties
      }
    >
      <div className="relative flex h-full flex-col justify-between p-2">
        <div
          className="h-3 w-full rounded-full"
          style={{ background: "var(--shhh-surface-raised)" }}
        />
        <div className="flex flex-col gap-1">
          <span
            className="h-4 w-[68%] self-start rounded-[0.7rem]"
            style={{ background: "var(--shhh-incoming)" }}
          />
          <span
            className="h-4 w-[58%] self-end rounded-[0.7rem]"
            style={{ background: "var(--shhh-outgoing)" }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span
            className="size-2.5 rounded-full"
            style={{ background: "var(--shhh-accent)" }}
          />
          <span
            className="h-2.5 w-10 rounded-full"
            style={{ background: "var(--shhh-nav-surface)" }}
          />
        </div>
      </div>
    </div>
  );
}
