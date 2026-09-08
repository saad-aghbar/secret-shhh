import { describe, expect, it } from "vitest";

import type { CallRecord } from "@/lib/calls/config";
import { CallError } from "@/lib/calls/errors";
import { assertCanMintCallToken } from "@/lib/livekit/token";

const live: CallRecord = {
  id: "call-1",
  conversationId: "c1",
  callerId: "saad",
  calleeId: "tala",
  type: "audio",
  roomName: "shhh-call-call-1",
  status: "connecting",
  createdAt: "2026-09-06T10:00:00.000Z",
  ringingAt: "2026-09-06T10:00:00.000Z",
  answeredAt: null,
  endedAt: null,
  endedBy: null,
  endReason: null,
  durationMs: null,
  videoUpgradedBy: null,
};

describe("call token grants", () => {
  it("allows only the two participants on a live call", () => {
    expect(() => assertCanMintCallToken(live, "saad")).not.toThrow();
    expect(() => assertCanMintCallToken(live, "tala")).not.toThrow();
    expect(() => assertCanMintCallToken(live, "stranger")).toThrow(CallError);
  });

  it("rejects ended rooms", () => {
    expect(() => assertCanMintCallToken({ ...live, status: "completed" }, "saad")).toThrow(CallError);
    expect(() => assertCanMintCallToken({ ...live, status: "missed" }, "tala")).toThrow(CallError);
  });
});
