"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * True once the element has come within `rootMargin` of the viewport, and stays
 * true afterwards.
 *
 * A long photo history mounts far more bubbles than a person can see — the
 * virtualizer overshoots before it measures real bubble heights, and every one
 * of those transient mounts used to ask for its own signed URL. Six sockets and
 * one server later, an upload happening at the same moment waits behind them.
 * Asking only for what is actually near the screen keeps that queue short.
 */
export function useNearViewport(
  ref: RefObject<Element | null>,
  { enabled = true, rootMargin = "600px" }: { enabled?: boolean; rootMargin?: string } = {},
) {
  // Environments without the observer (older Safari, jsdom) must not lose their
  // photos, so they start already "near".
  const supported = typeof IntersectionObserver !== "undefined";
  const [near, setNear] = useState(!enabled || !supported);

  useEffect(() => {
    if (!enabled || near || !supported) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, near, ref, rootMargin, supported]);

  return near;
}
