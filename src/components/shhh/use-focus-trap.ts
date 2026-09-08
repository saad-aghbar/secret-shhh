"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function focusableWithin(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (node) => node.offsetParent !== null || node === document.activeElement,
  );
}

/**
 * Keeps Tab inside an open overlay and returns focus to whatever opened it.
 * Without this, a closed sheet drops focus on <body> and keyboard users
 * restart from the top of the page.
 */
export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previous = document.activeElement as HTMLElement | null;

    const initial = window.requestAnimationFrame(() => {
      // Someone who started typing before the entry animation finished keeps
      // their caret — the trap must never yank focus out of a field in use.
      if (container.contains(document.activeElement)) return;
      const target = focusableWithin(container)[0];
      if (target) {
        target.focus();
      } else {
        container.setAttribute("tabindex", "-1");
        container.focus();
      }
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const nodes = focusableWithin(container);
      if (nodes.length === 0) {
        event.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const activeNode = document.activeElement as HTMLElement | null;

      if (!container.contains(activeNode)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && activeNode === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeNode === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.cancelAnimationFrame(initial);
      document.removeEventListener("keydown", onKeyDown, true);
      if (previous && document.contains(previous)) {
        previous.focus();
      }
    };
  }, [containerRef, active]);
}
