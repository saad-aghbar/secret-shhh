"use client";

import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ShhhSliderProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
};

export function ShhhSlider({ label, className, ...props }: ShhhSliderProps) {
  return (
    <input
      type="range"
      aria-label={label}
      className={cn("shhh-slider", className)}
      {...props}
    />
  );
}
