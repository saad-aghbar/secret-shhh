"use client";

import { useEffect, useState } from "react";

/** iOS Safari / PWA: keep composer above the software keyboard. */
export function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }

    const update = () => {
      const next = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setInset(Math.round(next));
    };

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    window.addEventListener("resize", update);

    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return inset;
}
