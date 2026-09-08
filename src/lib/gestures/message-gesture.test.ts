import { describe, expect, it } from "vitest";

import {
  createMessageGesture,
  LONG_PRESS_MS,
  rubberBandOffset,
  SWIPE_THRESHOLD_PX,
} from "@/lib/gestures/message-gesture";

describe("message gestures", () => {
  it("emits longpress after the hold threshold without movement", () => {
    const gesture = createMessageGesture();
    gesture.pointerDown(10, 10, 0);
    expect(gesture.tick(LONG_PRESS_MS - 1)).toBeNull();
    expect(gesture.tick(LONG_PRESS_MS)).toEqual({ type: "longpress" });
  });

  it("cancels long press when the pointer moves first", () => {
    const gesture = createMessageGesture();
    gesture.pointerDown(10, 10, 0);
    expect(gesture.pointerMove(10, 40)).toEqual({ type: "cancel" });
    expect(gesture.tick(LONG_PRESS_MS + 50)).toBeNull();
  });

  it("does not reply on a vertical scroll", () => {
    const gesture = createMessageGesture();
    gesture.pointerDown(20, 20, 0);
    expect(gesture.pointerMove(22, 80)).toEqual({ type: "cancel" });
    expect(gesture.pointerUp()).toBeNull();
  });

  it("follows the finger right and commits past the threshold", () => {
    const gesture = createMessageGesture();
    gesture.pointerDown(0, 0, 0);
    const progress = gesture.pointerMove(80, 2);
    expect(progress?.type).toBe("swipe-progress");
    if (progress?.type === "swipe-progress") {
      expect(progress.armed).toBe(true);
      expect(progress.offset).toBeGreaterThanOrEqual(SWIPE_THRESHOLD_PX);
    }
    expect(gesture.pointerUp()).toEqual({ type: "swipe-commit" });
  });

  it("springs back below the threshold", () => {
    const gesture = createMessageGesture();
    gesture.pointerDown(0, 0, 0);
    gesture.pointerMove(30, 1);
    expect(gesture.pointerUp()).toEqual({ type: "swipe-cancel" });
  });

  it("never treats a left swipe as a reply", () => {
    const gesture = createMessageGesture();
    gesture.pointerDown(80, 0, 0);
    expect(gesture.pointerMove(10, 1)).toEqual({ type: "cancel" });
  });

  it("rubber-bands past the threshold instead of hard-snapping", () => {
    expect(rubberBandOffset(40)).toBe(40);
    expect(rubberBandOffset(200)).toBeLessThan(200);
    expect(rubberBandOffset(-40)).toBe(0);
  });
});
