"use client";

import { ShhhSurface } from "@/components/shhh";

export function ChatDateSeparator({ label }: { label: string }) {
  return (
    <div className="flex justify-center py-3">
      <ShhhSurface
        tone="floating"
        round="pill"
        elevation="none"
        padding="none"
        className="shhh-date-separator px-3 py-1 text-[11px] font-medium text-secondary-text"
      >
        {label}
      </ShhhSurface>
    </div>
  );
}
