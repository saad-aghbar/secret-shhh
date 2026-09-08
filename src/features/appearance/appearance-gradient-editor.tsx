"use client";

import type { GradientDirection, WallpaperGradient } from "@/lib/appearance/config";
import { GRADIENT_PRESETS } from "@/lib/appearance/presets";
import { gradientCss } from "@/lib/appearance/css";
import { isSafeHexColor, normalizeHexColor } from "@/lib/appearance/validation";
import { cn } from "@/lib/utils";

const DIRECTIONS: Array<{ id: GradientDirection; label: string }> = [
  { id: "vertical", label: "Down" },
  { id: "diagonal", label: "Across" },
  { id: "horizontal", label: "Side" },
];

export function AppearanceGradientEditor({
  gradient,
  onChange,
}: {
  gradient: WallpaperGradient;
  onChange: (gradient: WallpaperGradient) => void;
}) {
  return (
    <div data-testid="appearance-gradient-editor" className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-primary-text">Gradient</p>
      <div className="flex flex-wrap gap-2">
        {GRADIENT_PRESETS.map((preset) => {
          const selected =
            preset.from === gradient.from &&
            preset.to === gradient.to &&
            preset.direction === gradient.direction;
          return (
            <button
              key={preset.id}
              type="button"
              data-testid={`appearance-gradient-${preset.id}`}
              aria-pressed={selected}
              aria-label={preset.label}
              className={cn(
                "shhh-press h-10 w-16 rounded-[0.95rem] shadow-[var(--shhh-shadow-soft)]",
                selected ? "ring-2 ring-[var(--shhh-accent)]" : "",
              )}
              style={{ background: gradientCss(preset.from, preset.to, preset.direction) }}
              onClick={() =>
                onChange({ from: preset.from, to: preset.to, direction: preset.direction })
              }
            />
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <ColorStop
          label="From"
          testId="appearance-gradient-from"
          value={gradient.from}
          onChange={(from) => onChange({ ...gradient, from })}
        />
        <ColorStop
          label="To"
          testId="appearance-gradient-to"
          value={gradient.to}
          onChange={(to) => onChange({ ...gradient, to })}
        />
      </div>
      <div className="grid grid-cols-3 gap-1 rounded-[1.25rem] bg-bg-soft p-1" role="radiogroup" aria-label="Direction">
        {DIRECTIONS.map((direction) => {
          const selected = gradient.direction === direction.id;
          return (
            <button
              key={direction.id}
              type="button"
              role="radio"
              aria-checked={selected}
              data-testid={`appearance-gradient-dir-${direction.id}`}
              onClick={() => onChange({ ...gradient, direction: direction.id })}
              className={cn(
                "shhh-press min-h-10 rounded-[1rem] text-sm",
                selected
                  ? "bg-surface-elevated text-primary-text shadow-[var(--shhh-shadow-soft)]"
                  : "text-secondary-text",
              )}
            >
              {direction.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ColorStop({
  label,
  value,
  testId,
  onChange,
}: {
  label: string;
  value: string;
  testId: string;
  onChange: (value: string) => void;
}) {
  const current = isSafeHexColor(value) ? value : "#4a756c";
  return (
    <label className="flex flex-1 items-center gap-2 text-sm text-secondary-text">
      <span className="relative size-9 overflow-hidden rounded-full shadow-[var(--shhh-shadow-soft)]">
        <span className="absolute inset-0" style={{ background: current }} />
        <input
          type="color"
          data-testid={testId}
          value={current}
          aria-label={label}
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={(event) => {
            const next = normalizeHexColor(event.target.value);
            if (isSafeHexColor(next)) onChange(next);
          }}
        />
      </span>
      {label}
    </label>
  );
}
