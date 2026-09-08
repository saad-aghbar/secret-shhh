"use client";

import { Check } from "lucide-react";

import { ShhhSheet } from "@/components/shhh";
import { darken, lighten, mix, readableForeground } from "@/lib/theme/contrast";
import type { HexColor, ThemeColorKey } from "@/lib/theme/config";
import { THEME_FIELD_META } from "@/lib/theme/config";
import { CURATED_THEME_SWATCHES } from "@/lib/theme/presets";
import { isSafeThemeHex, normalizeThemeHex } from "@/lib/theme/validation";
import { cn } from "@/lib/utils";

function harmonySwatches(current: HexColor): { id: string; label: string; value: HexColor }[] {
  return [
    { id: "softer", label: "Softer", value: lighten(current, 0.22) },
    { id: "deeper", label: "Deeper", value: darken(current, 0.18) },
    { id: "warm", label: "Warm", value: mix(current, "#c48b7a", 0.28) },
  ];
}

export function ThemeColorSheet({
  field,
  value,
  onSelect,
  onClose,
}: {
  field: ThemeColorKey | null;
  value: HexColor;
  onSelect: (color: HexColor) => void;
  onClose: () => void;
}) {
  const current = isSafeThemeHex(value) ? normalizeThemeHex(value) : "#4a756c";
  const title = field ? THEME_FIELD_META[field].label : "Color";
  const suggestions = harmonySwatches(current);

  return (
    <ShhhSheet open={Boolean(field)} onClose={onClose} title={title} data-testid="theme-color-sheet">
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-secondary-text mb-2 text-xs font-medium">Suggested</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((swatch) => (
              <SwatchButton
                key={swatch.id}
                label={swatch.label}
                value={swatch.value}
                selected={current === swatch.value}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
        <div>
          <p className="text-secondary-text mb-2 text-xs font-medium">Shhh colors</p>
          <div className="flex flex-wrap gap-2">
            {CURATED_THEME_SWATCHES.map((swatch) => (
              <SwatchButton
                key={swatch.id}
                label={swatch.label}
                value={swatch.value}
                selected={current === swatch.value}
                onSelect={onSelect}
              />
            ))}
            <label
              className="shhh-press relative grid size-10 place-items-center overflow-hidden rounded-full bg-[conic-gradient(var(--shhh-doodle-green),var(--shhh-doodle-coral),var(--shhh-doodle-blush),var(--shhh-doodle-blue),var(--shhh-doodle-lavender),var(--shhh-doodle-yellow),var(--shhh-doodle-charcoal),var(--shhh-doodle-white))] shadow-[var(--shhh-shadow-soft)]"
              aria-label="Choose custom color"
            >
              <input
                type="color"
                data-testid="theme-color-custom"
                value={current}
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={(event) => {
                  const next = normalizeThemeHex(event.target.value);
                  if (isSafeThemeHex(next)) onSelect(next);
                }}
              />
              <span className="pointer-events-none size-4 rounded-full bg-surface-elevated shadow-[var(--shhh-shadow-soft)]" />
            </label>
          </div>
        </div>
      </div>
    </ShhhSheet>
  );
}

function SwatchButton({
  label,
  value,
  selected,
  onSelect,
}: {
  label: string;
  value: HexColor;
  selected: boolean;
  onSelect: (color: HexColor) => void;
}) {
  const check = readableForeground(value);
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      data-testid={`theme-swatch-${label.toLowerCase().replace(/\s+/g, "-")}`}
      className={cn(
        "shhh-press relative size-10 rounded-full shadow-[var(--shhh-shadow-soft)]",
        "ring-2 ring-offset-2 ring-offset-[var(--shhh-bg)]",
        selected ? "ring-[var(--shhh-accent)]" : "ring-transparent",
      )}
      style={{ background: value }}
      onClick={() => onSelect(value)}
    >
      {selected ? (
        <span className="absolute inset-0 grid place-items-center" style={{ color: check }}>
          <Check className="size-3.5" strokeWidth={3} aria-hidden />
        </span>
      ) : null}
    </button>
  );
}
