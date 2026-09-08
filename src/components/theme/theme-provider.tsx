"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

import type { ThemePreference } from "@/lib/theme/config";

export function ThemeProvider({
  children,
  userId,
  defaultTheme = "system",
}: {
  children: ReactNode;
  userId?: string;
  defaultTheme?: ThemePreference;
}) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultTheme}
      enableSystem
      disableTransitionOnChange
      storageKey={userId ? `shhh.theme.${userId}` : "shhh.theme.anon"}
    >
      {children}
    </NextThemesProvider>
  );
}
