"use client";

import { Search, X } from "lucide-react";

import { ShhhIconButton } from "@/components/shhh";
import { cn } from "@/lib/utils";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
};

export function SearchInput({ value, onChange, onSubmit }: SearchInputProps) {
  return (
    <div className="relative">
      <label className="sr-only" htmlFor="shhh-search-q">
        Search
      </label>
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-text"
        aria-hidden
      />
      <input
        id="shhh-search-q"
        data-testid="search-input"
        dir="auto"
        value={value}
        placeholder="Search your conversation"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSubmit?.();
          }
        }}
        className={cn(
          "font-ui w-full min-h-12 rounded-[1.5rem] border border-divider bg-bg-soft/80 py-3 pe-12 ps-10",
          "text-base text-primary-text outline-none transition-[box-shadow,border-color,background-color]",
          "duration-[var(--shhh-motion-normal)] ease-[var(--shhh-ease-settle)]",
          "placeholder:text-muted-text",
          "focus:border-accent focus:bg-surface-elevated",
          "focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--shhh-accent)_22%,transparent)]",
        )}
      />
      <span
        className={cn(
          "absolute right-1.5 top-1/2 -translate-y-1/2 transition-[opacity,transform]",
          "duration-[var(--shhh-motion-normal)] ease-[var(--shhh-ease-settle)]",
          value
            ? "pointer-events-auto opacity-100 scale-100"
            : "pointer-events-none opacity-0 scale-90",
        )}
      >
        <ShhhIconButton
          type="button"
          label="Clear"
          className="size-9 bg-transparent shadow-none"
          tabIndex={value ? 0 : -1}
          onClick={() => onChange("")}
        >
          <X className="size-4" />
        </ShhhIconButton>
      </span>
    </div>
  );
}
