export const HOLD_THRESHOLD_MS = 260;
export const MOVE_CANCEL_PX = 16;
export const MAX_RECORD_MS = 60_000;

export type ShutterPhase = "idle" | "pressing" | "recording" | "canceled";

export type ShutterEvent =
  | { type: "photo" }
  | { type: "record-start" }
  | { type: "record-stop"; durationMs: number }
  | { type: "cancel" };

export type ShutterGestureOptions = {
  holdThresholdMs?: number;
  moveCancelPx?: number;
  maxRecordMs?: number;
};

/**
 * Pointer-driven shutter: tap = photo, hold past the threshold = video.
 * Time is injected so the machine is deterministic in tests.
 */
export function createShutterGesture(options: ShutterGestureOptions = {}) {
  const holdThresholdMs = options.holdThresholdMs ?? HOLD_THRESHOLD_MS;
  const moveCancelPx = options.moveCancelPx ?? MOVE_CANCEL_PX;
  const maxRecordMs = options.maxRecordMs ?? MAX_RECORD_MS;

  let phase: ShutterPhase = "idle";
  let startX = 0;
  let startY = 0;
  let downAt = 0;
  let recordAt = 0;

  function reset() {
    phase = "idle";
    startX = 0;
    startY = 0;
    downAt = 0;
    recordAt = 0;
  }

  function pointerDown(x: number, y: number, now: number) {
    if (phase !== "idle") return;
    phase = "pressing";
    startX = x;
    startY = y;
    downAt = now;
    recordAt = 0;
  }

  function pointerMove(x: number, y: number): ShutterEvent | null {
    if (phase !== "pressing") return null;
    const dx = x - startX;
    const dy = y - startY;
    if (dx * dx + dy * dy >= moveCancelPx * moveCancelPx) {
      phase = "canceled";
      return { type: "cancel" };
    }
    return null;
  }

  function tick(now: number): ShutterEvent | null {
    if (phase === "pressing" && now - downAt >= holdThresholdMs) {
      phase = "recording";
      recordAt = now;
      return { type: "record-start" };
    }
    if (phase === "recording" && now - recordAt >= maxRecordMs) {
      const durationMs = now - recordAt;
      reset();
      return { type: "record-stop", durationMs };
    }
    return null;
  }

  function pointerUp(now: number): ShutterEvent | null {
    if (phase === "pressing") {
      reset();
      return { type: "photo" };
    }
    if (phase === "recording") {
      const durationMs = Math.max(0, now - recordAt);
      reset();
      return { type: "record-stop", durationMs };
    }
    if (phase === "canceled") {
      reset();
      return null;
    }
    return null;
  }

  function pointerCancel(now: number): ShutterEvent | null {
    if (phase === "recording") {
      const durationMs = Math.max(0, now - recordAt);
      reset();
      return { type: "record-stop", durationMs };
    }
    if (phase === "pressing") {
      reset();
      return { type: "cancel" };
    }
    if (phase === "canceled") {
      reset();
      return null;
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
    elapsedMs: (now: number) => {
      if (phase === "recording") return Math.max(0, now - recordAt);
      if (phase === "pressing") return Math.max(0, now - downAt);
      return 0;
    },
  };
}

export type ShutterGesture = ReturnType<typeof createShutterGesture>;
