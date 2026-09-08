"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type ShhhNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  testId?: string;
};

export type ShhhNavProps = {
  items: readonly ShhhNavItem[];
  className?: string;
};

export function ShhhNav({ items, className }: ShhhNavProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4",
        className,
      )}
      style={{ paddingBottom: "calc(var(--shhh-safe-bottom) + 0.75rem)" }}
    >
      <ul
        className={cn(
          "pointer-events-auto flex h-16 w-full max-w-md items-stretch gap-0.5",
          "rounded-[1.75rem] bg-nav-surface p-1.5 shadow-[var(--shhh-shadow-float)]",
        )}
      >
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex min-w-0 flex-1">
              <Link
                href={item.href}
                data-testid={item.testId}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shhh-nav-bubble flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-[1.35rem] px-1 text-[11px] font-medium",
                  active
                    ? "bg-nav-selected-fill text-nav-selected"
                    : "text-nav-text-muted hover:text-nav-text",
                )}
              >
                <Icon className="size-5 shrink-0" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
