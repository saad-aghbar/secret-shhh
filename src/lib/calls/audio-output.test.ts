import { describe, expect, it } from "vitest";

import { pickSpeakerDevice, pickSystemDevice } from "@/lib/calls/audio-output";

describe("pickSpeakerDevice", () => {
  it("returns null when there is only one usable output", () => {
    expect(pickSpeakerDevice([{ deviceId: "default", label: "Default" }])).toBeNull();
    expect(
      pickSpeakerDevice([
        { deviceId: "default", label: "Default" },
        { deviceId: "communications", label: "Communications" },
      ]),
    ).toBeNull();
  });

  it("prefers a speaker-labelled device over default", () => {
    expect(
      pickSpeakerDevice(
        [
          { deviceId: "default", label: "Default" },
          { deviceId: "spk", label: "Speakerphone" },
        ],
        "default",
      ),
    ).toBe("spk");
  });

  it("falls back to the first non-default device", () => {
    expect(
      pickSpeakerDevice([
        { deviceId: "default", label: "Default" },
        { deviceId: "usb", label: "USB headset" },
      ]),
    ).toBe("usb");
  });
});

describe("pickSystemDevice", () => {
  it("prefers the default device when leaving speaker", () => {
    expect(
      pickSystemDevice(
        [
          { deviceId: "spk", label: "Speaker" },
          { deviceId: "default", label: "Default" },
        ],
        "spk",
      ),
    ).toBe("default");
  });
});
