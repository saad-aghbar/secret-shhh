import { describe, expect, it } from "vitest";

import { mapMediaErrorToConsumer } from "@/lib/media/consumer-errors";
import { formatDurationMs } from "@/lib/media/duration";
import {
  isAllowedVideoMime,
  sniffVideoMime,
  validateVideoUploadMeta,
} from "@/lib/media/validation";
import { videoResumeFingerprint } from "@/lib/media/video-fingerprint";
import { posterSeekSeconds } from "@/lib/media/video-poster-seek";
import {
  assertPartSizeCoversConfiguredMax,
  partByteRange,
  R2_MAX_PARTS,
  videoPartPlan,
  VIDEO_UPLOAD_PART_BYTES,
} from "@/lib/media/video-parts";

function fakeMp4(size: number) {
  const body = new Uint8Array(size);
  body[3] = 24;
  body.set([0x66, 0x74, 0x79, 0x70], 4);
  body.set([0x69, 0x73, 0x6f, 0x6d], 8);
  return body;
}

describe("video part math", () => {
  it("uses 8 MiB parts for a 256 MiB file", () => {
    const plan = videoPartPlan(256 * 1024 * 1024);
    expect(plan.partSize).toBe(VIDEO_UPLOAD_PART_BYTES);
    expect(plan.totalParts).toBe(32);
    expect(plan.lastPartSize).toBe(VIDEO_UPLOAD_PART_BYTES);
  });

  it("keeps non-final parts uniform", () => {
    const total = 8 * 1024 * 1024 * 3 + 1234;
    const plan = videoPartPlan(total);
    expect(plan.totalParts).toBe(4);
    expect(partByteRange(total, plan.partSize, 1).size).toBe(plan.partSize);
    expect(partByteRange(total, plan.partSize, 2).size).toBe(plan.partSize);
    expect(partByteRange(total, plan.partSize, 3).size).toBe(plan.partSize);
    expect(partByteRange(total, plan.partSize, 4).size).toBe(1234);
  });

  it("covers the configured 2 GiB max within 10,000 parts", () => {
    const plan = assertPartSizeCoversConfiguredMax(2_147_483_648);
    expect(plan.totalParts).toBeLessThanOrEqual(R2_MAX_PARTS);
    expect(plan.partSize).toBeGreaterThanOrEqual(VIDEO_UPLOAD_PART_BYTES);
  });
});

describe("video mime", () => {
  it("allows mp4 quicktime webm and rejects others", () => {
    expect(isAllowedVideoMime("video/mp4")).toBe(true);
    expect(isAllowedVideoMime("video/quicktime")).toBe(true);
    expect(isAllowedVideoMime("video/webm")).toBe(true);
    expect(isAllowedVideoMime("video/avi")).toBe(false);
    expect(validateVideoUploadMeta({ mimeType: "video/avi", size: 100 }).ok).toBe(false);
  });

  it("sniffs mp4 and webm containers", () => {
    expect(sniffVideoMime(fakeMp4(64))).toBe("video/mp4");
    const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(sniffVideoMime(webm)).toBe("video/webm");
  });

  it("maps oversize to consumer copy", () => {
    const result = validateVideoUploadMeta({
      mimeType: "video/mp4",
      size: Number.MAX_SAFE_INTEGER,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(mapMediaErrorToConsumer(result.message)).toBe("This video is too large to send.");
    }
  });
});

describe("resume fingerprint", () => {
  it("is stable for the same file and changes if the last bytes change", async () => {
    const a = new File([fakeMp4(2 * 1024 * 1024)], "clip.mp4", {
      type: "video/mp4",
      lastModified: 1_700_000_000_000,
    });
    const first = await videoResumeFingerprint(a);
    const again = await videoResumeFingerprint(a);
    expect(first).toBe(again);
    const changed = new Uint8Array(fakeMp4(2 * 1024 * 1024));
    changed[changed.length - 1] = 9;
    const b = new File([changed], "clip.mp4", {
      type: "video/mp4",
      lastModified: 1_700_000_000_000,
    });
    expect(await videoResumeFingerprint(b)).not.toBe(first);
  });
});

describe("poster seek", () => {
  it("uses an early frame when duration is known and t=0 when it is not", () => {
    expect(posterSeekSeconds(10)).toBe(1);
    expect(posterSeekSeconds(2)).toBe(0.2);
    expect(posterSeekSeconds(Number.POSITIVE_INFINITY)).toBe(0);
    expect(posterSeekSeconds(Number.NaN)).toBe(0);
  });
});

describe("duration copy", () => {
  it("formats minutes and hours without jargon", () => {
    expect(formatDurationMs(5_000)).toBe("0:05");
    expect(formatDurationMs(125_000)).toBe("2:05");
    expect(formatDurationMs(3_661_000)).toBe("1:01:01");
  });
});
