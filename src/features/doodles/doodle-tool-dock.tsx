"use client";

import { Eraser, Highlighter, Pencil } from "lucide-react";
import type { ReactNode } from "react";

import type { DoodleEditorTool } from "@/lib/doodles/document";
import { cn } from "@/lib/utils";

type DoodleToolDockProps = {
  tool: DoodleEditorTool;
  color: string;
  onTool: (tool: DoodleEditorTool) => void;
  onColor: () => void;
  paletteOpen: boolean;
};

function ToolButton({
  testId,
  label,
  active,
  onClick,
  children,
}: {
  testId: string;
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "shhh-press grid size-11 place-items-center rounded-full",
        active
          ? "bg-accent-soft text-accent-strong"
          : "text-primary-text/72 hover:bg-bg-soft hover:text-primary-text",
      )}
    >
      {children}
    </button>
  );
}

export function DoodleToolDock({ tool, color, onTool, onColor, paletteOpen }: DoodleToolDockProps) {
  return (
    <div
      data-testid="doodle-dock"
      className="bg-surface-floating/92 flex items-center gap-1 rounded-full px-1.5 py-1.5 shadow-[var(--shhh-shadow-float)] backdrop-blur-md"
    >
      <ToolButton
        testId="doodle-tool-pen"
        label="Pen"
        active={tool === "pen"}
        onClick={() => onTool("pen")}
      >
        <Pencil className="size-[1.15rem]" strokeWidth={2.1} />
      </ToolButton>
      <ToolButton
        testId="doodle-tool-marker"
        label="Marker"
        active={tool === "marker"}
        onClick={() => onTool("marker")}
      >
        <Highlighter className="size-[1.15rem]" strokeWidth={2.1} />
      </ToolButton>
      <ToolButton
        testId="doodle-tool-eraser"
        label="Eraser"
        active={tool === "eraser"}
        onClick={() => onTool("eraser")}
      >
        <Eraser className="size-[1.15rem]" strokeWidth={2.1} />
      </ToolButton>
      <button
        type="button"
        data-testid="doodle-color"
        aria-label="Choose color"
        aria-expanded={paletteOpen}
        onClick={onColor}
        className={cn(
          "shhh-press mx-0.5 grid size-11 place-items-center rounded-full",
          paletteOpen ? "bg-accent-soft" : "hover:bg-bg-soft",
        )}
      >
        <span
          className="size-6 rounded-full shadow-[var(--shhh-shadow-soft)] ring-2 ring-[color-mix(in_srgb,var(--shhh-text)_12%,transparent)]"
          style={{ background: color }}
        />
      </button>
    </div>
  );
}
