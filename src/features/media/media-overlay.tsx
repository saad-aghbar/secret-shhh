"use client";

import type { ReactNode } from "react";

import { ShhhModal, ShhhSheet } from "@/components/shhh";
import { useMediaQuery } from "@/lib/hooks/use-media-query";

/** Desktop deserves a centered dialog; phones deserve a thumb-reachable sheet. */
export function useIsDesktop(query = "(min-width: 768px)") {
  return useMediaQuery(query);
}

export type MediaOverlayProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * One overlay contract for every media flow so create, add, edit, and confirm
 * all share focus trapping, scroll lock, and Esc behavior.
 */
export function MediaOverlay({
  open,
  onClose,
  title,
  footer,
  children,
  className,
}: MediaOverlayProps) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <ShhhModal open={open} onClose={onClose} title={title} footer={footer} className={className}>
        {children}
      </ShhhModal>
    );
  }

  return (
    <ShhhSheet open={open} onClose={onClose} title={title} footer={footer} className={className}>
      {children}
    </ShhhSheet>
  );
}
