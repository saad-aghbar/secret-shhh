import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { acquireCallRoom, releaseCallRoom, resetCallRoomSessionForTests } from "@/lib/livekit/session";

function mockHandles() {
  const state = { value: "connected" };
  return {
    room: {
      get state() {
        return state.value;
      },
    },
    disconnect: vi.fn(async () => {
      state.value = "disconnected";
    }),
  };
}

describe("call room session", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetCallRoomSessionForTests();
  });

  afterEach(() => {
    resetCallRoomSessionForTests();
    vi.useRealTimers();
  });

  it("reuses an in-flight room across remount", async () => {
    const connect = vi.fn(async () => mockHandles());
    const [first, second] = await Promise.all([
      acquireCallRoom("call-1", connect),
      acquireCallRoom("call-1", connect),
    ]);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });

  it("does not disconnect on an immediate remount release", async () => {
    const handles = mockHandles();
    const connect = vi.fn(async () => handles);
    await acquireCallRoom("call-1", connect);
    releaseCallRoom("call-1");
    await acquireCallRoom("call-1", connect);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(handles.disconnect).not.toHaveBeenCalled();
  });

  it("disconnects after the last release settles", async () => {
    const handles = mockHandles();
    await acquireCallRoom("call-1", async () => handles);
    releaseCallRoom("call-1");
    await vi.advanceTimersByTimeAsync(4_000);
    expect(handles.disconnect).toHaveBeenCalledTimes(1);
  });
});
