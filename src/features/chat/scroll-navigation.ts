/**
 * Shared chat viewport navigation. Prefer this over ad-hoc scrollToIndex calls
 * so New messages / jump-to-latest / own-send / future reply jumps share one motion policy.
 */

export type ChatScrollMotion = "shhh" | "instant";

type VirtualizerLike = {
  scrollToIndex: (index: number, options?: { align?: "start" | "center" | "end" | "auto" }) => void;
  getTotalSize: () => number;
};

const NEAR_GLIDE_PX = 1200;
const FAR_LEAVE_PX = 900;
const GLIDE_MS = 360;

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function easeSettle(t: number) {
  // Approx --shhh-ease-settle
  return 1 - Math.pow(1 - t, 3);
}

function animateScrollTop(node: HTMLElement, to: number, durationMs: number): Promise<void> {
  const from = node.scrollTop;
  const delta = to - from;
  if (Math.abs(delta) < 1) {
    node.scrollTop = to;
    return Promise.resolve();
  }
  const started = performance.now();
  return new Promise((resolve) => {
    function frame(now: number) {
      const t = Math.min(1, (now - started) / durationMs);
      node.scrollTop = from + delta * easeSettle(t);
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}

function distanceFromBottom(node: HTMLElement) {
  return node.scrollHeight - node.scrollTop - node.clientHeight;
}

/**
 * Navigate to a specific virtual row (Search/History focus).
 * Jump near the index then settle so the target sits ~40% from the top.
 */
export async function navigateChatToMessage(
  parent: HTMLElement | null,
  virtualizer: VirtualizerLike,
  index: number,
  options: { motion?: ChatScrollMotion } = {},
): Promise<void> {
  if (!parent || index < 0) {
    return;
  }
  // Cleaner 40% settle without unused var
  const motion = options.motion ?? "shhh";
  const instant = motion === "instant" || prefersReducedMotion();
  virtualizer.scrollToIndex(index, { align: "center" });
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  // Center ≈ 50%; nudge up ~10% of viewport so target sits near 40% from top.
  const settled = Math.max(0, parent.scrollTop - Math.round(parent.clientHeight * 0.1));

  if (instant) {
    parent.scrollTop = settled;
    return;
  }

  await animateScrollTop(parent, settled, 180);
  virtualizer.scrollToIndex(index, { align: "center" });
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const again = Math.max(0, parent.scrollTop - Math.round(parent.clientHeight * 0.1));
  if (Math.abs(again - parent.scrollTop) > 2) {
    parent.scrollTop = again;
  }
}

/**
 * Navigate to the newest message (last virtual index).
 * Near: eased scrollTop. Far: jump near end, then glide — never animate thousands of rows.
 */
export async function navigateChatToEnd(
  parent: HTMLElement | null,
  virtualizer: VirtualizerLike,
  lastIndex: number,
  options: { motion?: ChatScrollMotion } = {},
): Promise<void> {
  if (!parent || lastIndex < 0) {
    return;
  }

  const motion = options.motion ?? "shhh";
  const instant = motion === "instant" || prefersReducedMotion();

  if (instant) {
    virtualizer.scrollToIndex(lastIndex, { align: "end" });
    parent.scrollTop = parent.scrollHeight;
    return;
  }

  const distance = distanceFromBottom(parent);
  if (distance > NEAR_GLIDE_PX) {
    // Jump efficiently near the destination, then glide the visible remainder.
    virtualizer.scrollToIndex(lastIndex, { align: "end" });
    const afterJump = distanceFromBottom(parent);
    if (afterJump > FAR_LEAVE_PX) {
      parent.scrollTop = Math.max(0, parent.scrollHeight - parent.clientHeight - FAR_LEAVE_PX);
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  const target = Math.max(0, parent.scrollHeight - parent.clientHeight);
  await animateScrollTop(parent, target, GLIDE_MS);
  // Ensure virtualizer end alignment after layout settles.
  virtualizer.scrollToIndex(lastIndex, { align: "end" });
  parent.scrollTop = parent.scrollHeight;
}
