"use client";

import Link from "next/link";

import { ThemeMiniPreview } from "@/features/theme/theme-mini-preview";
import type { ThemeMode } from "@/lib/theme/config";
import type { ThemePayload } from "@/lib/theme/types";

function ThemeEntryCard({
  target,
  payload,
}: {
  target: ThemeMode;
  payload: ThemePayload;
}) {
  const resolved = target === "light" ? payload.resolvedLight : payload.resolvedDark;
  const title = target === "light" ? "Light theme" : "Dark theme";
  const customized = !resolved.isDefault;

  return (
    <div
      data-testid={`theme-entry-${target}`}
      className="flex items-center gap-3 rounded-[1.35rem] bg-bg-soft/80 p-2.5"
    >
      <ThemeMiniPreview tokens={resolved.tokens} className="h-[4.6rem] w-[4.2rem] shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-primary-text text-sm font-semibold">{title}</p>
        <p className="text-secondary-text text-xs">
          {customized ? "Your colors" : "Shhh original"}
        </p>
      </div>
      <Link
        href={`/more/appearance/theme/${target}`}
        data-testid={`theme-customize-${target}`}
        className="shhh-press text-accent rounded-full px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)]"
      >
        Customize
      </Link>
    </div>
  );
}

export function ThemeEntryCards({ payload }: { payload: ThemePayload }) {
  return (
    <div className="flex flex-col gap-2" data-testid="theme-entries">
      <ThemeEntryCard target="light" payload={payload} />
      <ThemeEntryCard target="dark" payload={payload} />
    </div>
  );
}
