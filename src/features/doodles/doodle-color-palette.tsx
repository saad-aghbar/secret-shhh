"use client";

import { DOODLE_PALETTE } from "@/lib/doodles/palette";
import { isSafeHexColor, normalizeHexColor } from "@/lib/doodles/validation";
import { cn } from "@/lib/utils";

type DoodleColorPaletteProps = {
  color: string;
  recentColors: string[];
  onSelect: (color: string) => void;
};

export function DoodleColorPalette({ color, recentColors, onSelect }: DoodleColorPaletteProps) {
  return (
    <div
      data-testid="doodle-palette"
      className="bg-surface-floating flex flex-col gap-2 rounded-[1.45rem] px-2.5 py-2.5 shadow-[var(--shhh-shadow-float)]"
    >
      <div className="flex flex-nowrap items-center justify-center gap-1.5">
        {DOODLE_PALETTE.map((swatch) => {
          const selected = normalizeHexColor(color) === swatch.value;
          return (
            <button
              key={swatch.id}
              type="button"
              data-testid={`doodle-swatch-${swatch.id}`}
              aria-label={swatch.label}
              aria-pressed={selected}
              className={cn(
                "shhh-press relative size-8 rounded-full shadow-[var(--shhh-shadow-soft)]",
                "ring-2 ring-offset-2 ring-offset-[var(--shhh-surface-floating)]",
                selected ? "scale-110 ring-[var(--shhh-accent)]" : "ring-transparent",
              )}
              style={{ background: swatch.value }}
              onClick={() => onSelect(swatch.value)}
            >
              {selected ? (
                <span className="absolute inset-0 grid place-items-center text-[11px] text-white mix-blend-difference">
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
        <label
          className="shhh-press relative grid size-8 place-items-center overflow-hidden rounded-full bg-[conic-gradient(var(--shhh-doodle-green),var(--shhh-doodle-coral),var(--shhh-doodle-blush),var(--shhh-doodle-blue),var(--shhh-doodle-lavender),var(--shhh-doodle-yellow),var(--shhh-doodle-charcoal),var(--shhh-doodle-white))] shadow-[var(--shhh-shadow-soft)]"
          aria-label="Custom color"
        >
          <input
            type="color"
            data-testid="doodle-color-input"
            value={isSafeHexColor(color) ? color : "#4a756c"}
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={(event) => {
              const next = normalizeHexColor(event.target.value);
              if (isSafeHexColor(next)) onSelect(next);
            }}
          />
          <span className="pointer-events-none size-4 rounded-full bg-surface-elevated shadow-[var(--shhh-shadow-soft)]" />
        </label>
      </div>
      {recentColors.length > 0 ? (
        <div className="flex items-center justify-center gap-1.5">
          {recentColors.map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`Recent color ${value}`}
              className="size-6 rounded-full shadow-[var(--shhh-shadow-soft)] ring-1 ring-[color-mix(in_srgb,var(--shhh-text)_10%,transparent)]"
              style={{ background: value }}
              onClick={() => onSelect(value)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
