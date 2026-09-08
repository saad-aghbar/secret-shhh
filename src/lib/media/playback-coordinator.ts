"use client";

/**
 * One thing plays at a time.
 *
 * Two voice notes talking over each other, or a video playing under a voice note,
 * is the fastest way to make a chat feel broken. Anything that starts playing claims
 * the floor and whatever held it is paused.
 */

type Active = { id: string; pause: () => void };

let active: Active | null = null;

export function claimPlayback(id: string, pause: () => void) {
  if (active && active.id !== id) {
    const previous = active;
    active = null;
    // A holder that throws on pause must not take the floor down with it.
    try {
      previous.pause();
    } catch {
      /* it is going away either way */
    }
  }
  active = { id, pause };
}

export function releasePlayback(id: string) {
  if (active?.id === id) active = null;
}

/** Pause whatever is playing — used when a viewer opens or the page is hidden. */
export function pauseActivePlayback() {
  if (!active) return;
  const previous = active;
  active = null;
  try {
    previous.pause();
  } catch {
    /* it is going away either way */
  }
}

/** Test helper: forget the current holder without pausing it. */
export function resetPlaybackCoordinator() {
  active = null;
}
