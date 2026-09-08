import { describe, expect, it } from "vitest";

import { DeviceOwnerRegistry } from "@/lib/media/device-owner";

describe("device owner", () => {
  it("lets a call steal the camera or recorder", () => {
    const registry = new DeviceOwnerRegistry();
    expect(registry.claim("camera").ok).toBe(true);
    expect(registry.claim("voice-recorder").ok).toBe(false);
    expect(registry.claim("call").ok).toBe(true);
    expect(registry.current()).toBe("call");
    expect(registry.claim("camera")).toMatchObject({
      ok: false,
      message: "Finish the call first.",
    });
    registry.release("call");
    expect(registry.current()).toBeNull();
  });
});
