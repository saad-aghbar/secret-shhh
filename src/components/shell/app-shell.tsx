import type { CSSProperties, ReactNode } from "react";

import { BottomNav } from "@/components/shell/bottom-nav";
import { ChatWallpaperHost } from "@/features/appearance/chat-wallpaper-host";
import { PresenceHeartbeat } from "@/features/presence/presence-heartbeat";
import { appearanceCssVars } from "@/lib/appearance/css";
import type { AppearancePayload } from "@/lib/appearance/types";
import { publicEnv } from "@/lib/public-env";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: ReactNode;
  title?: string;
  subtitle?: ReactNode;
  brandSubtitle?: ReactNode;
  actions?: ReactNode;
  /**
   * Chat uses wallpaper background; other sections use flat surface.
   * `wide` gives photo-dominant surfaces a roomier centered composition
   * instead of stretching phone-sized tiles across a monitor.
   */
  variant?: "chat" | "plain" | "wide";
  /** When true, keep presence heartbeat alive (authenticated screens). */
  trackPresence?: boolean;
  headerLeading?: ReactNode;
  appearance?: AppearancePayload;
  conversationId?: string;
};

export function AppShell({
  children,
  title,
  subtitle,
  brandSubtitle,
  actions,
  variant = "plain",
  trackPresence = true,
  headerLeading,
  appearance,
  conversationId,
}: AppShellProps) {
  const wallpaperActive = Boolean(appearance && appearance.resolved.layer.type !== "none");
  const wallpaperVars = appearance ? appearanceCssVars(appearance.resolved) : null;

  return (
    <div
      className={cn(
        "relative flex min-h-dvh flex-col",
        variant === "chat" && "h-dvh overflow-hidden",
      )}
      data-wallpaper-active={variant === "chat" && wallpaperActive ? "true" : undefined}
      style={{
        background: variant === "chat" ? "var(--shhh-wallpaper)" : "var(--shhh-bg)",
        paddingTop: "var(--shhh-safe-top)",
        ...(wallpaperVars as CSSProperties | null),
      }}
    >
      {variant === "chat" && appearance && conversationId ? (
        <ChatWallpaperHost conversationId={conversationId} initial={appearance} />
      ) : null}
      {trackPresence ? <PresenceHeartbeat /> : null}
      <header className="sticky top-0 z-30 border-b border-divider bg-surface-elevated/90 backdrop-blur-md">
        <div
          className={cn(
            "mx-auto flex min-h-14 items-center gap-3 px-4 py-3",
            variant === "wide" ? "max-w-5xl" : "max-w-lg sm:max-w-xl",
          )}
        >
          {headerLeading}
          <div className="min-w-0 flex-1">
            {title ? (
              <>
                <p className="truncate text-lg font-semibold leading-tight text-primary-text">
                  {title}
                </p>
                {brandSubtitle ? <div className="mt-0.5">{brandSubtitle}</div> : null}
                {subtitle ? (
                  typeof subtitle === "string" ? (
                    <p className="mt-0.5 truncate text-xs text-secondary-text">{subtitle}</p>
                  ) : (
                    <div className="mt-0.5">{subtitle}</div>
                  )
                ) : null}
              </>
            ) : (
              <>
                <p className="font-handmade text-base tracking-tight text-primary-text">
                  {publicEnv.NEXT_PUBLIC_APP_NAME}
                </p>
                {brandSubtitle ? <div className="mt-0.5">{brandSubtitle}</div> : null}
              </>
            )}
          </div>
          {actions}
        </div>
      </header>

      <main
        className={cn(
          "relative z-10 mx-auto flex w-full flex-1 flex-col",
          variant === "chat" && "min-h-0 max-w-lg overflow-hidden sm:max-w-xl",
          variant === "plain" && "max-w-lg px-4 pt-5 sm:max-w-xl",
          variant === "wide" && "max-w-5xl px-4 pt-5 sm:px-6",
        )}
        style={
          variant === "chat"
            ? undefined
            : {
                paddingBottom:
                  "calc(5.5rem + var(--shhh-safe-bottom) + 1.5rem + var(--shhh-mini-player, 0px))",
              }
        }
      >
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
