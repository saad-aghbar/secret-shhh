"use client";

/**
 * Reference-counted page scroll lock.
 *
 * Overlays overlap: a sheet can still be playing its exit while the next one
 * mounts. If each overlay saved and restored the document styles on its own,
 * the second would capture the first's locked values and hand them back — the
 * page would stay `position: fixed` forever and nothing could scroll again.
 * One shared counter means only the first lock captures, only the last releases.
 */
let locks = 0;
let release: (() => void) | null = null;

export function lockPageScroll(): () => void {
  if (typeof document === "undefined") return () => {};

  if (locks === 0) {
    const scrollY = window.scrollY;
    const { style } = document.documentElement;
    const previous = {
      overflow: style.overflow,
      position: style.position,
      top: style.top,
      width: style.width,
    };

    style.overflow = "hidden";
    style.position = "fixed";
    style.top = `-${scrollY}px`;
    style.width = "100%";

    release = () => {
      style.overflow = previous.overflow;
      style.position = previous.position;
      style.top = previous.top;
      style.width = previous.width;
      window.scrollTo(0, scrollY);
    };
  }

  locks += 1;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    locks -= 1;
    if (locks === 0) {
      release?.();
      release = null;
    }
  };
}
