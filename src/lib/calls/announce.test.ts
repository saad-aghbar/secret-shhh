import { describe, expect, it } from "vitest";

import { callAnnouncement } from "@/lib/calls/announce";

describe("callAnnouncement", () => {
  it("announces incoming video with the partner name", () => {
    expect(
      callAnnouncement({
        hadCall: false,
        call: { status: "ringing", type: "video", role: "callee" },
        partnerName: "Tala",
        network: "good",
      }),
    ).toBe("Incoming video call from Tala");
  });

  it("announces connect, weak, reconnect, and end — never a timer", () => {
    expect(
      callAnnouncement({
        hadCall: true,
        call: { status: "connected", type: "audio", role: "caller" },
        partnerName: "Tala",
        network: "good",
      }),
    ).toBe("Call connected");
    expect(
      callAnnouncement({
        hadCall: true,
        call: { status: "connected", type: "video", role: "caller" },
        partnerName: "Tala",
        network: "weak",
      }),
    ).toBe("Connection is weak");
    expect(
      callAnnouncement({
        hadCall: true,
        call: { status: "reconnecting", type: "audio", role: "caller" },
        partnerName: "Tala",
        network: "reconnecting",
      }),
    ).toBe("Reconnecting");
    expect(
      callAnnouncement({
        hadCall: true,
        call: null,
        partnerName: "Tala",
        network: "good",
      }),
    ).toBe("Call ended");
  });

  it("announces when the partner turns the call into video", () => {
    expect(
      callAnnouncement({
        hadCall: true,
        call: { status: "connected", type: "video", role: "callee" },
        partnerName: "Saad",
        network: "good",
        videoUpgradeNote: true,
      }),
    ).toBe("Saad turned on video");
  });
});

