import { describe, expect, it } from "vitest";

import {
  cameraRecordingExtension,
  cameraRecordingFileName,
  cameraRecordingPassesAllowlist,
  pickCameraRecorderMime,
  toCameraVideoFile,
} from "@/lib/media/camera-recorder";
import { isAllowedVideoMime, normalizeMime } from "@/lib/media/validation";

describe("pickCameraRecorderMime", () => {
  it("prefers mp4 with avc1 when supported", () => {
    const supported = new Set(["video/mp4;codecs=avc1,mp4a.40.2", "video/webm"]);
    expect(pickCameraRecorderMime((mime) => supported.has(mime))).toBe(
      "video/mp4;codecs=avc1,mp4a.40.2",
    );
  });

  it("falls through to webm vp8 when mp4 is unavailable", () => {
    const supported = new Set(["video/webm;codecs=vp8,opus", "video/webm"]);
    expect(pickCameraRecorderMime((mime) => supported.has(mime))).toBe(
      "video/webm;codecs=vp8,opus",
    );
  });

  it("returns null when nothing is supported", () => {
    expect(pickCameraRecorderMime(() => false)).toBeNull();
  });
});

describe("camera recording files", () => {
  it("stores the produced MIME on the File and maps the extension", () => {
    const blob = new Blob([new Uint8Array([1, 0x45, 0xdf, 0xa3])], {
      type: "video/webm;codecs=vp8,opus",
    });
    const file = toCameraVideoFile(blob, "video/webm;codecs=vp8,opus", 1_700_000_000_000);
    expect(file.type).toBe("video/webm;codecs=vp8,opus");
    expect(file.name).toBe("shhh-1700000000000.webm");
    expect(cameraRecordingExtension("video/mp4;codecs=avc1")).toBe("mp4");
    expect(cameraRecordingFileName("video/mp4", 12)).toBe("shhh-12.mp4");
  });

  it("passes allowlist after codecs are stripped", () => {
    expect(cameraRecordingPassesAllowlist("video/webm;codecs=vp8,opus")).toBe(true);
    expect(cameraRecordingPassesAllowlist("video/mp4;codecs=avc1,mp4a.40.2")).toBe(true);
    expect(normalizeMime("video/webm;codecs=vp8")).toBe("video/webm");
    expect(isAllowedVideoMime("video/webm;codecs=vp9,opus")).toBe(true);
  });
});
