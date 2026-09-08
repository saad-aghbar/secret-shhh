"use client";

import { Check } from "lucide-react";

import { ThemeMiniPreview } from "@/features/theme/theme-mini-preview";
import { deriveThemeTokens } from "@/lib/theme/derive";
import type { ThemeConfig, ThemeMode } from "@/lib/theme/config";
import { themePresetsFor } from "@/lib/theme/presets";

export function ThemePresetRow({
  target,
  config,
  onSelect,
}: {
  target: ThemeMode;
  config: ThemeConfig;
  onSelect: (presetId: string) => void;
}) {
  const customized = Object.keys(config.colors).length > 0;

  return (
    <div>
      <p className="text-primary-text mb-2 text-sm font-semibold">Presets</p>
      <div
        data-testid="theme-presets-scroller"
        className="overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div
          role="listbox"
          aria-label="Theme presets"
          data-testid="theme-presets"
          className="flex w-max min-w-full gap-2.5"
        >
          {themePresetsFor(target).map((preset) => {
            const selected = !customized && config.preset === preset.id;
            const tokens = deriveThemeTokens(target, preset.colors);
            return (
              <button
                key={preset.id}
                type="button"
                role="option"
                aria-selected={selected}
                data-testid={`theme-preset-${preset.id}`}
                className="shhh-press flex w-[5.35rem] flex-col items-center gap-1.5"
                onClick={() => onSelect(preset.id)}
              >
                <span className="relative h-[4.4rem] w-full">
                  <ThemeMiniPreview
                    tokens={tokens}
                    radius="1.15rem"
                    frame={selected ? tokens.accent : undefined}
                    className="h-full w-full"
                  />
                  {selected ? (
                    <span
                      className="absolute end-1 top-1 grid size-4 place-items-center rounded-full text-[10px]"
                      style={{ background: tokens.accent, color: tokens.onAccent }}
                    >
                      <Check className="size-2.5" strokeWidth={3} aria-hidden />
                    </span>
                  ) : null}
                </span>
                <span className="text-primary-text text-center text-[11px] font-medium">
                  {preset.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
