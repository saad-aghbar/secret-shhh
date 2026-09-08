"use client";

import { Heart, ImageIcon, Mic, Music2 } from "lucide-react";
import type { CSSProperties } from "react";

import { ChatDateSeparator } from "@/features/chat/chat-date-separator";
import { ShhhBubble } from "@/components/shhh";
import { themeTokenVars } from "@/lib/theme/css";
import { THEME_PREVIEW_COPY } from "@/lib/theme/sample";
import type { ResolvedTheme } from "@/lib/theme/config";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Chat", active: true },
  { label: "Media", active: false },
  { label: "Music", active: false },
  { label: "More", active: false },
] as const;

export function ThemeAppPreview({
  resolved,
  className,
}: {
  resolved: ResolvedTheme;
  className?: string;
}) {
  return (
    <div
      data-testid="theme-app-preview"
      className={cn(
        "relative isolate overflow-hidden rounded-[1.7rem] shadow-[var(--shhh-shadow-float)]",
        "[clip-path:inset(0_round_1.7rem)]",
        className,
      )}
      style={
        {
          ...themeTokenVars(resolved.tokens),
          background: "var(--shhh-bg)",
          colorScheme: resolved.mode,
        } as CSSProperties
      }
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "var(--shhh-wallpaper)" }}
      />
      <div className="relative z-[1] flex min-h-[18.5rem] flex-col sm:min-h-[26rem]">
        <div className="border-b border-divider bg-surface-elevated/90 px-4 py-3 backdrop-blur-md">
          <p className="truncate text-sm font-semibold text-primary-text">
            {THEME_PREVIEW_COPY.partner}
          </p>
          <p className="text-[11px] text-secondary-text">today</p>
        </div>

        <div className="flex flex-1 flex-col justify-end gap-2 px-3 pt-2 pb-2">
          <ChatDateSeparator label={THEME_PREVIEW_COPY.date} />
          <div className="flex flex-col items-start gap-1">
            <ShhhBubble side="incoming" group="single" dir="auto">
              {THEME_PREVIEW_COPY.incoming}
            </ShhhBubble>
            <span className="bg-surface-elevated text-primary-text rounded-pill ms-3 -mt-1 flex items-center gap-1 px-2.5 py-1 text-[14px] shadow-[var(--shhh-shadow-soft)]">
              <Heart className="text-love size-3.5 fill-current" aria-hidden />
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <ShhhBubble side="outgoing" group="single" dir="auto">
              {THEME_PREVIEW_COPY.outgoing}
            </ShhhBubble>
            <p className="text-muted-text px-1.5 text-[11px]">Read</p>
          </div>
          <div className="flex justify-start">
            <div className="bg-incoming-bubble text-incoming-text flex items-center gap-2 rounded-[1.2rem] px-3 py-2 shadow-[var(--shhh-shadow-soft)]">
              <span className="bg-accent grid size-7 place-items-center rounded-full text-on-accent">
                <span className="sr-only">Play</span>
                <span aria-hidden className="ms-0.5 border-y-4 border-s-8 border-y-transparent border-s-current" />
              </span>
              <span className="flex h-4 items-end gap-0.5" aria-hidden>
                {[3, 6, 4, 8, 5, 7, 3].map((h, i) => (
                  <span
                    key={i}
                    className="w-0.5 rounded-full bg-accent"
                    style={{ height: `${h}px` }}
                  />
                ))}
              </span>
              <span className="text-[11px] text-muted-text">{THEME_PREVIEW_COPY.voice}</span>
            </div>
          </div>
          <div className="flex justify-end">
            <div className="bg-outgoing-bubble relative size-16 overflow-hidden rounded-[1.1rem] shadow-[var(--shhh-shadow-soft)]">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(160deg, var(--shhh-love-soft), var(--shhh-accent-soft))",
                }}
              />
              <ImageIcon className="text-accent absolute inset-0 m-auto size-5" aria-hidden />
            </div>
          </div>
          <p className="text-muted-text px-1 text-end text-[11px]" dir="auto">
            {THEME_PREVIEW_COPY.arabic}
          </p>
        </div>

        <div className="px-3 pb-2">
          <div className="bg-composer text-composer-placeholder flex items-center gap-2 rounded-[1.75rem] px-4 py-3 text-sm shadow-[var(--shhh-shadow-float)]">
            <Mic className="size-4 shrink-0" aria-hidden />
            {THEME_PREVIEW_COPY.composer}
          </div>
        </div>

        <div className="px-3 pb-3">
          <div className="bg-nav-surface flex h-12 items-stretch rounded-[1.35rem] p-1 shadow-[var(--shhh-shadow-soft)]">
            {NAV.map((item) => (
              <div
                key={item.label}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center justify-center rounded-[1.1rem] text-[10px] font-medium",
                  item.active
                    ? "bg-nav-selected-fill text-nav-selected"
                    : "text-nav-text-muted",
                )}
              >
                {item.label === "Music" ? <Music2 className="size-3.5" aria-hidden /> : null}
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
