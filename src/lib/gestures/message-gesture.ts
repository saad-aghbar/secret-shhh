export const LONG_PRESS_MS = 420;
export const MOVE_CANCEL_PX = 10;
export const AXIS_LOCK_PX = 8;
export const AXIS_LOCK_RATIO = 1.6;
export const SWIPE_THRESHOLD_PX = 64;
export const MAX_DRAG_PX = 96;

export type MessageGesturePhase = "idle" | "pressing" | "swiping" | "canceled";
export type GestureAxis = "none" | "horizontal" | "vertical";

export type MessageGestureEvent =
  | { type: "longpress" }
  | { type: "swipe-progress"; offset: number; armed: boolean }
  | { type: "swipe-commit" }
  | { type: "swipe-cancel" }
  | { type: "cancel" };

export type MessageGestureOptions = {
  longPressMs?: number;
  moveCancelPx?: number;
  axisLockPx?: number;
  swipeThresholdPx?: number;
  maxDragPx?: number;
};

export function rubberBandOffset(dx: number, threshold = SWIPE_THRESHOLD_PX, max = MAX_DRAG_PX) {
  const right = Math.max(0, dx);
  if (right <= threshold) {
    return right;
  }
  const extra = right - threshold;
  return Math.min(max, threshold + extra * 0.35);
}

/**
 * Touch-only message gesture: long-press opens actions, swipe-right replies.
 * Time is injected so the machine is deterministic in tests.
 */
export function createMessageGesture(options: MessageGestureOptions = {}) {
  const longPressMs = options.longPressMs ?? LONG_PRESS_MS;
  const moveCancelPx = options.moveCancelPx ?? MOVE_CANCEL_PX;
  const axisLockPx = options.axisLockPx ?? AXIS_LOCK_PX;
  const swipeThresholdPx = options.swipeThresholdPx ?? SWIPE_THRESHOLD_PX;
  const maxDragPx = options.maxDragPx ?? MAX_DRAG_PX;

  let phase: MessageGesturePhase = "idle";
  let axis: GestureAxis = "none";
  let startX = 0;
  let startY = 0;
  let downAt = 0;
  let offset = 0;
  let longPressed = false;

  function reset() {
    phase = "idle";
    axis = "none";
    startX = 0;
    startY = 0;
    downAt = 0;
    offset = 0;
    longPressed = false;
  }

  function lockAxis(dx: number, dy: number) {
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    if (ady >= axisLockPx && ady >= adx * AXIS_LOCK_RATIO) {
      axis = "vertical";
      return;
    }
    if (adx >= axisLockPx && adx >= ady * AXIS_LOCK_RATIO) {
      axis = "horizontal";
    }
  }

  function pointerDown(x: number, y: number, now: number) {
    if (phase !== "idle") return;
    phase = "pressing";
    axis = "none";
    startX = x;
    startY = y;
    downAt = now;
    offset = 0;
    longPressed = false;
  }

  function pointerMove(x: number, y: number): MessageGestureEvent | null {
    if (phase !== "pressing" && phase !== "swiping") return null;
    const dx = x - startX;
    const dy = y - startY;
    if (axis === "none") {
      lockAxis(dx, dy);
    }
    if (axis === "vertical") {
      phase = "canceled";
      return { type: "cancel" };
    }
    const distance = Math.hypot(dx, dy);
    if (phase === "pressing" && distance >= moveCancelPx) {
      if (axis === "horizontal" && dx > 0) {
        phase = "swiping";
      } else {
        phase = "canceled";
        return { type: "cancel" };
      }
    }
    if (phase === "swiping") {
      offset = rubberBandOffset(dx, swipeThresholdPx, maxDragPx);
      return {
        type: "swipe-progress",
        offset,
        armed: offset >= swipeThresholdPx,
      };
    }
    return null;
  }

  function tick(now: number): MessageGestureEvent | null {
    if (phase === "pressing" && !longPressed && now - downAt >= longPressMs) {
      longPressed = true;
      phase = "canceled";
      return { type: "longpress" };
    }
    return null;
  }

  function pointerUp(): MessageGestureEvent | null {
    if (phase === "swiping") {
      const committed = offset >= swipeThresholdPx;
      reset();
      return committed ? { type: "swipe-commit" } : { type: "swipe-cancel" };
    }
    if (phase === "canceled" || phase === "pressing") {
      reset();
      return null;
    }
    reset();
    return null;
  }

  function pointerCancel(): MessageGestureEvent | null {
    if (phase === "swiping") {
      reset();
      return { type: "swipe-cancel" };
    }
    if (phase !== "idle") {
      reset();
      return { type: "cancel" };
    }
    return null;
  }

  return {
    pointerDown,
    pointerMove,
    pointerUp,
    pointerCancel,
    tick,
    reset,
    phase: () => phase,
    axis: () => axis,
    offset: () => offset,
  };
}

export type MessageGesture = ReturnType<typeof createMessageGesture>;
