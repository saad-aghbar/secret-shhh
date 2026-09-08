"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type ShhhToggleOption = {
  value: string;
  label: string;
  icon?: ReactNode;
};

export type ShhhToggleProps = {
  value: string;
  options: readonly ShhhToggleOption[];
  onChange: (value: string) => void;
  label: string;
  className?: string;
};

export function ShhhToggle({ value, options, onChange, label, className }: ShhhToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "grid gap-1 rounded-[1.25rem] bg-bg-soft p-1",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "shhh-press flex min-h-10 items-center justify-center gap-1.5 rounded-[1rem] px-2 py-2 text-sm transition",
              selected
                ? "bg-surface-elevated text-primary-text shadow-[var(--shhh-shadow-soft)]"
                : "text-secondary-text hover:text-primary-text",
            )}
          >
            {option.icon}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
