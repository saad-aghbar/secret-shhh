import { describe, expect, it } from "vitest";

import { CALL_RING_TIMEOUT_MS } from "@/lib/calls/config";
import {
  canTransition,
  endReasonFor,
  nextStatus,
  outcomeForAction,
} from "@/lib/calls/machine";

describe("call state machine", () => {
  it("creates into ringing only", () => {
    expect(nextStatus("ringing", "create")).toBe("ringing");
    expect(canTransition("connected", "create")).toBe(false);
  });

  it("accepts only while ringing", () => {
    expect(nextStatus("ringing", "accept")).toBe("connecting");
    expect(nextStatus("connected", "accept")).toBeNull();
    expect(nextStatus("declined", "accept")).toBeNull();
  });

  it("maps decline / cancel / timeout / fail outcomes", () => {
    expect(nextStatus("ringing", "decline")).toBe("declined");
    expect(nextStatus("ringing", "cancel")).toBe("cancelled");
    expect(nextStatus("ringing", "timeout")).toBe("missed");
    expect(nextStatus("connecting", "fail")).toBe("failed");
    expect(outcomeForAction("timeout", "ringing")).toBe("missed");
    expect(outcomeForAction("decline", "ringing")).toBe("declined");
    expect(outcomeForAction("cancel", "ringing")).toBe("cancelled");
  });

  it("connects, reconnects, and recovers without ending", () => {
    expect(nextStatus("connecting", "connect")).toBe("connected");
    expect(nextStatus("connected", "reconnect")).toBe("reconnecting");
    expect(nextStatus("reconnecting", "recovered")).toBe("connected");
    expect(nextStatus("reconnecting", "connect")).toBe("connected");
    expect(canTransition("ended", "reconnect")).toBe(false);
  });

  it("end while ringing cancels; end after answer completes", () => {
    expect(nextStatus("ringing", "end")).toBe("cancelled");
    expect(nextStatus("connected", "end")).toBe("completed");
    expect(endReasonFor("end", "ringing")).toBe("cancelled");
    expect(endReasonFor("end", "connected")).toBe("hangup");
    expect(endReasonFor("timeout", "ringing")).toBe("timeout");
  });

  it("upgrades video without changing lifecycle status", () => {
    expect(nextStatus("connecting", "upgrade")).toBe("connecting");
    expect(nextStatus("connected", "upgrade")).toBe("connected");
    expect(nextStatus("reconnecting", "upgrade")).toBe("reconnecting");
    expect(nextStatus("ringing", "upgrade")).toBeNull();
    expect(nextStatus("completed", "upgrade")).toBeNull();
  });

  it("rejects transitions from terminal statuses", () => {
    for (const status of ["completed", "missed", "declined", "cancelled", "failed"] as const) {
      expect(canTransition(status, "accept")).toBe(false);
      expect(canTransition(status, "end")).toBe(false);
    }
  });

  it("uses a 40s ring timeout", () => {
    expect(CALL_RING_TIMEOUT_MS).toBe(40_000);
  });
});
