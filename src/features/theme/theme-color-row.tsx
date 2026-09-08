"use client";

import type { ThemeAuthoredColors, ThemeColorKey, ThemeTokens } from "@/lib/theme/config";
import { THEME_FIELD_META } from "@/lib/theme/config";
import { cn } from "@/lib/utils";

function MiniSwatch({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cn("size-9 shrink-0 rounded-full shadow-[var(--shhh-shadow-soft)]", className)}
      style={{ background: color }}
    />
  );
}

export function ThemeColorRow({
  field,
  authored,
  tokens,
  onOpen,
}: {
  field: ThemeColorKey;
  authored: ThemeAuthoredColors;
  tokens: ThemeTokens;
  onOpen: (field: ThemeColorKey) => void;
}) {
  const meta = THEME_FIELD_META[field];
  const value = authored[field];

  return (
    <button
      type="button"
      data-testid={`theme-color-${field}`}
      aria-label={`${meta.label}, change color`}
      className="shhh-press flex min-h-14 w-full items-center gap-3 rounded-[1.25rem] px-1 py-1.5 text-start"
      onClick={() => onOpen(field)}
    >
      <ColorGlyph field={field} authored={authored} tokens={tokens} />
      <span className="min-w-0 flex-1">
        <span className="text-primary-text block text-sm font-semibold">{meta.label}</span>
        <span className="text-secondary-text block text-xs">Tap to change</span>
      </span>
      <MiniSwatch color={value} />
    </button>
  );
}

function ColorGlyph({
  field,
  authored,
  tokens,
}: {
  field: ThemeColorKey;
  authored: ThemeAuthoredColors;
  tokens: ThemeTokens;
}) {
  if (field === "outgoing" || field === "incoming") {
    return (
      <span className="flex w-14 flex-col gap-1" aria-hidden>
        <span
          className="h-4 w-10 self-end rounded-[0.7rem_0.7rem_0.25rem_0.7rem]"
          style={{ background: authored.outgoing }}
        />
        <span
          className="h-4 w-9 self-start rounded-[0.7rem_0.7rem_0.7rem_0.25rem]"
          style={{ background: authored.incoming }}
        />
      </span>
    );
  }
  if (field === "navSurface" || field === "navSelected") {
    return (
      <span
        className="flex h-9 w-14 items-center justify-center gap-1 rounded-full px-1"
        style={{ background: authored.navSurface }}
        aria-hidden
      >
        <span className="size-2 rounded-full" style={{ background: tokens.navTextMuted }} />
        <span
          className="h-5 w-5 rounded-full"
          style={{ background: tokens.navSelectedFill }}
        />
        <span className="size-2 rounded-full" style={{ background: tokens.navTextMuted }} />
      </span>
    );
  }
  if (field === "button") {
    return (
      <span
        className="flex h-8 min-w-14 items-center justify-center rounded-full px-2 text-[10px] font-semibold"
        style={{ background: authored.button, color: tokens.onButton }}
        aria-hidden
      >
        Apply
      </span>
    );
  }
  if (field === "surface" || field === "sheet" || field === "composer") {
    return (
      <span className="relative h-9 w-12" aria-hidden>
        <span
          className="absolute inset-0 rounded-[0.7rem]"
          style={{ background: authored.surface }}
        />
        <span
          className="absolute inset-1 rounded-[0.5rem] shadow-[var(--shhh-shadow-soft)]"
          style={{
            background:
              field === "sheet"
                ? authored.sheet
                : field === "composer"
                  ? authored.composer
                  : tokens.surfaceRaised,
          }}
        />
      </span>
    );
  }
  return <MiniSwatch color={authored[field]} className="size-10" />;
}
