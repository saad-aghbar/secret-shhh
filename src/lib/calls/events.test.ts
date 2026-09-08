import { describe, expect, it } from "vitest";

import { callAgainLabel, callEventTitle, parseCallEventMeta } from "@/lib/calls/events";

describe("call event copy", () => {
  it("writes consumer titles for every outcome", () => {
    expect(
      callEventTitle({ callId: "1", callType: "audio", outcome: "completed", durationMs: 38 * 60_000 }),
    ).toBe("Audio call · 38 min");
    expect(
      callEventTitle({ callId: "1", callType: "video", outcome: "missed", durationMs: null }),
    ).toBe("Missed video call");
    expect(
      callEventTitle({ callId: "1", callType: "audio", outcome: "declined", durationMs: null }),
    ).toBe("Call declined");
    expect(
      callEventTitle({ callId: "1", callType: "audio", outcome: "cancelled", durationMs: null }),
    ).toBe("No answer");
    expect(
      callEventTitle({ callId: "1", callType: "video", outcome: "failed", durationMs: null }),
    ).toBe("Couldn't connect the call.");
  });

  it("labels Call again / Video call again", () => {
    expect(callAgainLabel("audio")).toBe("Call again");
    expect(callAgainLabel("video")).toBe("Video call again");
  });

  it("parses stored metadata and rejects junk", () => {
    expect(parseCallEventMeta({ callId: "x", callType: "audio", outcome: "completed", durationMs: 12 })).toEqual({
      callId: "x",
      callType: "audio",
      outcome: "completed",
      durationMs: 12,
    });
    expect(parseCallEventMeta({ callType: "audio" })).toBeNull();
  });
});
