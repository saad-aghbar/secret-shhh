import type { LucideIcon } from "lucide-react";
import { ImageIcon, MessageCircle, MoreHorizontal, Music2 } from "lucide-react";

export type AppSectionId = "chat" | "media" | "music" | "more";

export type AppSection = {
  id: AppSectionId;
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in empty / placeholder states */
  emptyTitle: string;
  emptyDescription: string;
};

/**
 * Central registry for primary destinations.
 * Future private sections (memories, notes, …) can be added here
 * and optionally linked from More without restructuring navigation.
 */
export const APP_SECTIONS: readonly AppSection[] = [
  {
    id: "chat",
    href: "/chat",
    label: "Chat",
    icon: MessageCircle,
    emptyTitle: "Quiet here for now",
    emptyDescription: "Your private conversation will settle in softly.",
  },
  {
    id: "media",
    href: "/media",
    label: "Media",
    icon: ImageIcon,
    emptyTitle: "Nothing shared yet",
    emptyDescription: "Photos and little moments will gather here.",
  },
  {
    id: "music",
    href: "/music",
    label: "Music",
    icon: Music2,
    emptyTitle: "Our music will show up here.",
    emptyDescription: "Songs you send each other will gather softly.",
  },
  {
    id: "more",
    href: "/more",
    label: "More",
    icon: MoreHorizontal,
    emptyTitle: "A little more",
    emptyDescription: "Settings and extras live nearby.",
  },
] as const;

export function getSection(id: AppSectionId): AppSection {
  const section = APP_SECTIONS.find((item) => item.id === id);
  if (!section) {
    throw new Error(`Unknown section: ${id}`);
  }
  return section;
}
