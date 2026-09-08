"use client";

import { Check, ImagePlus } from "lucide-react";
import type { CSSProperties } from "react";

import type { WallpaperConfig } from "@/lib/appearance/config";
import {
  COLOR_PRESETS,
  GRADIENT_PRESETS,
  matchingColorPresetId,
  matchingGradientPresetId,
  PRESET_ROW_COLOR_IDS,
  PRESET_ROW_GRADIENT_IDS,
} from "@/lib/appearance/presets";
import { gradientCss } from "@/lib/appearance/css";
import { cn } from "@/lib/utils";

type PresetKind = "default" | "color" | "gradient" | "photo";

export function AppearancePresets({
  config,
  onSelectDefault,
  onSelectColor,
  onSelectGradient,
  onSelectPhoto,
}: {
  config: WallpaperConfig;
  onSelectDefault: () => void;
  onSelectColor: (color: string) => void;
  onSelectGradient: (id: string) => void;
  onSelectPhoto: () => void;
}) {
  const colorId = matchingColorPresetId(config);
  const gradientId = matchingGradientPresetId(config);
  const selected: PresetKind =
    config.type === "image"
      ? "photo"
      : config.type === "gradient"
        ? "gradient"
        : config.type === "solid"
          ? "color"
          : "default";

  return (
    <div
      data-testid="appearance-presets-scroller"
      className="overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div
        role="listbox"
        aria-label="Wallpaper presets"
        data-testid="appearance-presets"
        className="flex w-max min-w-full gap-2 overflow-visible"
      >
        <PresetCard
          id="default"
          label="Default"
          selected={selected === "default"}
          onSelect={onSelectDefault}
          swatchClass="bg-[image:var(--shhh-wallpaper)]"
        />
        {PRESET_ROW_COLOR_IDS.map((id) => {
          const preset = COLOR_PRESETS.find((item) => item.id === id)!;
          return (
            <PresetCard
              key={id}
              id={id}
              label={preset.label}
              selected={selected === "color" && colorId === id}
              onSelect={() => onSelectColor(preset.value)}
              swatchStyle={{ background: preset.value }}
            />
          );
        })}
        {PRESET_ROW_GRADIENT_IDS.map((id) => {
          const preset = GRADIENT_PRESETS.find((item) => item.id === id)!;
          return (
            <PresetCard
              key={id}
              id={id}
              label={preset.label}
              selected={selected === "gradient" && gradientId === id}
              onSelect={() => onSelectGradient(id)}
              swatchStyle={{ background: gradientCss(preset.from, preset.to, preset.direction) }}
            />
          );
        })}
        <PresetCard
          id="photo"
          label="Photo"
          selected={selected === "photo"}
          onSelect={onSelectPhoto}
          icon
        />
      </div>
    </div>
  );
}

function PresetCard({
  id,
  label,
  selected,
  onSelect,
  swatchClass,
  swatchStyle,
  icon,
}: {
  id: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
  swatchClass?: string;
  swatchStyle?: CSSProperties;
  icon?: boolean;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      data-testid={`appearance-preset-${id}`}
      onClick={onSelect}
      className={cn(
        "shhh-press flex w-[4.15rem] shrink-0 flex-col items-center gap-1.5 rounded-[1.2rem] border-2 p-1.5",
        selected ? "border-[var(--shhh-accent)]" : "border-transparent",
      )}
    >
      <span
        className={cn(
          "relative grid size-12 place-items-center overflow-hidden rounded-[1.05rem] shadow-[var(--shhh-shadow-soft)]",
          swatchClass,
          icon && "bg-bg-soft text-accent",
        )}
        style={swatchStyle}
      >
        {icon ? <ImagePlus className="size-5" strokeWidth={2} aria-hidden /> : null}
        {selected ? (
          <span className="absolute end-1 top-1 grid size-4 place-items-center rounded-full bg-accent text-[10px] text-on-accent">
            <Check className="size-2.5" strokeWidth={3} aria-hidden />
          </span>
        ) : null}
      </span>
      <span className="text-[11px] font-medium text-secondary-text">{label}</span>
    </button>
  );
}
