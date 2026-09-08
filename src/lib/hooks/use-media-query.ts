"use client";

import { useLayoutEffect, useState } from "react";

/**
 * Viewport match that is safe for SSR. The first render (server and
 * hydration) is always false so Client Components cannot disagree with HTML.
 * After hydrate, layout effect syncs to the real query before paint.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useLayoutEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [query]);

  return matches;
}
