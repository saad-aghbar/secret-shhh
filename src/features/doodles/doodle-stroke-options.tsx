"use client";

import { ShhhSlider } from "@/components/shhh";
import { MAX_OPACITY, MAX_STROKE_WIDTH, MIN_OPACITY, MIN_STROKE_WIDTH } from "@/lib/doodles/limits";
import type { DoodleEditorTool } from "@/lib/doodles/document";

type DoodleStrokeOptionsProps = {
  tool: DoodleEditorTool;
  color: string;
  width: number;
  opacity: number;
  onWidth: (value: number) => void;
  onOpacity: (value: number) => void;
};

export function DoodleStrokeOptions({
  tool,
  color,
  width,
  opacity,
  onWidth,
  onOpacity,
}: DoodleStrokeOptionsProps) {
  const preview = 6 + ((width - MIN_STROKE_WIDTH) / (MAX_STROKE_WIDTH - MIN_STROKE_WIDTH)) * 22;

  return (
    <div
      data-testid="doodle-stroke-options"
      className="bg-surface-floating flex w-[16.5rem] flex-col gap-3 rounded-[1.45rem] px-3.5 py-3 shadow-[var(--shhh-shadow-float)]"
    >
      <div className="flex items-center justify-center py-1">
        <span
          aria-hidden
          className="rounded-full"
          style={{
            width: preview,
            height: preview,
            background: tool === "eraser" ? "color-mix(in srgb, var(--shhh-text) 22%, transparent)" : color,
            opacity: tool === "eraser" ? 1 : opacity,
          }}
        />
      </div>
      <label className="block">
        <span className="sr-only">Change thickness</span>
        <ShhhSlider
          label="Change thickness"
          data-testid="doodle-thickness"
          min={MIN_STROKE_WIDTH}
          max={MAX_STROKE_WIDTH}
          step={0.002}
          value={width}
          onChange={(event) => onWidth(Number(event.target.value))}
        />
      </label>
      {tool === "marker" ? (
        <label className="block">
          <span className="sr-only">Change opacity</span>
          <ShhhSlider
            label="Change opacity"
            data-testid="doodle-opacity"
            min={MIN_OPACITY}
            max={MAX_OPACITY}
            step={0.02}
            value={opacity}
            onChange={(event) => onOpacity(Number(event.target.value))}
          />
        </label>
      ) : null}
    </div>
  );
}
