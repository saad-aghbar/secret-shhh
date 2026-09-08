"use client";

import { ShhhNav } from "@/components/shhh";
import { APP_SECTIONS } from "@/components/shell/sections";

export function BottomNav() {
  return (
    <ShhhNav
      items={APP_SECTIONS.map((section) => ({
        href: section.href,
        label: section.label,
        icon: section.icon,
        testId: `nav-${section.id}`,
      }))}
    />
  );
}
