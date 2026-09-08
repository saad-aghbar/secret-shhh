import { describe, expect, it } from "vitest";

import { cameraErrorCopy, captureErrorStatus, microphoneErrorCopy } from "@/lib/media/capture-errors";

describe("capture errors", () => {
  it("maps getUserMedia names to consumer statuses", () => {
    expect(captureErrorStatus({ name: "NotAllowedError" })).toBe("denied");
    expect(captureErrorStatus({ name: "NotFoundError" })).toBe("missing");
    expect(captureErrorStatus({ name: "NotReadableError" })).toBe("busy");
    expect(captureErrorStatus({ name: "NotSupportedError" })).toBe("unsupported");
  });

  it("never leaks engine names in copy", () => {
    expect(microphoneErrorCopy("denied").title).toBe("Microphone access is off.");
    expect(cameraErrorCopy("denied").body).toContain("continue without video");
    expect(JSON.stringify(microphoneErrorCopy("busy"))).not.toContain("NotReadableError");
  });
});
