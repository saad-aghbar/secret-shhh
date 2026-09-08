import { describe, expect, it } from "vitest";

import {
  createShutterGesture,
  HOLD_THRESHOLD_MS,
  MAX_RECORD_MS,
} from "@/features/chat/shutter-gesture";

describe("createShutterGesture", () => {
  it("emits photo on a tap below the hold threshold", () => {
    const shutter = createShutterGesture();
    shutter.pointerDown(10, 10, 0);
    expect(shutter.tick(HOLD_THRESHOLD_MS - 1)).toBeNull();
    expect(shutter.pointerUp(HOLD_THRESHOLD_MS - 1)).toEqual({ type: "photo" });
    expect(shutter.phase()).toBe("idle");
  });

  it("starts recording after the hold threshold and stops on release", () => {
    const shutter = createShutterGesture();
    shutter.pointerDown(10, 10, 0);
    expect(shutter.tick(HOLD_THRESHOLD_MS)).toEqual({ type: "record-start" });
    expect(shutter.phase()).toBe("recording");
    expect(shutter.pointerUp(HOLD_THRESHOLD_MS + 400)).toEqual({
      type: "record-stop",
      durationMs: 400,
    });
  });

  it("cancels a hold when the pointer moves before the threshold", () => {
    const shutter = createShutterGesture();
    shutter.pointerDown(10, 10, 0);
    expect(shutter.pointerMove(40, 10)).toEqual({ type: "cancel" });
    expect(shutter.tick(HOLD_THRESHOLD_MS)).toBeNull();
    expect(shutter.pointerUp(HOLD_THRESHOLD_MS + 10)).toBeNull();
    expect(shutter.phase()).toBe("idle");
  });

  it("ignores movement after recording has started", () => {
    const shutter = createShutterGesture();
    shutter.pointerDown(10, 10, 0);
    shutter.tick(HOLD_THRESHOLD_MS);
    expect(shutter.pointerMove(80, 80)).toBeNull();
    expect(shutter.phase()).toBe("recording");
  });

  it("keeps the clip when pointercancel happens while recording", () => {
    const shutter = createShutterGesture();
    shutter.pointerDown(10, 10, 0);
    shutter.tick(HOLD_THRESHOLD_MS);
    expect(shutter.pointerCancel(HOLD_THRESHOLD_MS + 120)).toEqual({
      type: "record-stop",
      durationMs: 120,
    });
  });

  it("cancels a press on pointercancel before recording", () => {
    const shutter = createShutterGesture();
    shutter.pointerDown(10, 10, 0);
    expect(shutter.pointerCancel(80)).toEqual({ type: "cancel" });
    expect(shutter.phase()).toBe("idle");
  });

  it("auto-stops at the max duration", () => {
    const shutter = createShutterGesture();
    shutter.pointerDown(0, 0, 0);
    shutter.tick(HOLD_THRESHOLD_MS);
    expect(shutter.tick(HOLD_THRESHOLD_MS + MAX_RECORD_MS)).toEqual({
      type: "record-stop",
      durationMs: MAX_RECORD_MS,
    });
    expect(shutter.phase()).toBe("idle");
  });
});
