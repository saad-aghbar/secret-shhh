"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { ShhhToggle } from "@/components/shhh";
import { apiSaveThemeMode } from "@/lib/theme/client-api";
import type { ThemePreference } from "@/lib/theme/config";
import { cn } from "@/lib/utils";

const options = [
  { value: "light", label: "Light", icon: <Sun className="size-4" aria-hidden /> },
  { value: "dark", label: "Dark", icon: <Moon className="size-4" aria-hidden /> },
  { value: "system", label: "System", icon: <Monitor className="size-4" aria-hidden /> },
] as const;

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const isClient = useIsClient();

  if (!isClient) {
    return <div className={cn("h-11 w-full rounded-[1.25rem] bg-bg-soft", className)} aria-hidden />;
  }

  return (
    <ShhhToggle
      label="Theme"
      className={className}
      value={theme ?? "system"}
      options={options}
      onChange={(value) => {
        const next = value as ThemePreference;
        setTheme(next);
        void apiSaveThemeMode(next).catch(() => undefined);
      }}
    />
  );
}
