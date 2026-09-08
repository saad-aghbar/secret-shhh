"use client";

import { COLOR_PRESETS } from "@/lib/appearance/presets";
import { isSafeHexColor, normalizeHexColor } from "@/lib/appearance/validation";
import { cn } from "@/lib/utils";

export function AppearanceColorPicker({
  color,
  onSelect,
}: {
  color: string;
  onSelect: (color: string) => void;
}) {
  const current = isSafeHexColor(color) ? normalizeHexColor(color) : "#4a756c";

  return (
    <div data-testid="appearance-color-picker" className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-primary-text">Color</p>
      <div className="flex flex-wrap gap-2">
        {COLOR_PRESETS.map((swatch) => {
          const selected = current === swatch.value;
          return (
            <button
              key={swatch.id}
              type="button"
              data-testid={`appearance-swatch-${swatch.id}`}
              aria-label={swatch.label}
              aria-pressed={selected}
              className={cn(
                "shhh-press relative size-10 rounded-full shadow-[var(--shhh-shadow-soft)]",
                "ring-2 ring-offset-2 ring-offset-[var(--shhh-bg)]",
                selected ? "ring-[var(--shhh-accent)]" : "ring-transparent",
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
          className="shhh-press relative grid size-10 place-items-center overflow-hidden rounded-full bg-[conic-gradient(var(--shhh-doodle-green),var(--shhh-doodle-coral),var(--shhh-doodle-blush),var(--shhh-doodle-blue),var(--shhh-doodle-lavender),var(--shhh-doodle-yellow),var(--shhh-doodle-charcoal),var(--shhh-doodle-white))] shadow-[var(--shhh-shadow-soft)]"
          aria-label="Custom color"
        >
          <input
            type="color"
            data-testid="appearance-color-custom"
            value={current}
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={(event) => {
              const next = normalizeHexColor(event.target.value);
              if (isSafeHexColor(next)) onSelect(next);
            }}
          />
          <span className="pointer-events-none size-4 rounded-full bg-surface-elevated shadow-[var(--shhh-shadow-soft)]" />
        </label>
      </div>
    </div>
  );
}
