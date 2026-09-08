import { describe, expect, it, vi } from "vitest";

import { playMediaElement } from "@/lib/media/play-media";

function media(play: () => Promise<void>): HTMLMediaElement {
  return { play } as HTMLMediaElement;
}

describe("playMediaElement", () => {
  it("swallows AbortError so unmount does not become an unhandled rejection", async () => {
    const onUnsupported = vi.fn();
    playMediaElement(
      media(() => Promise.reject(new DOMException("interrupted", "AbortError"))),
      onUnsupported,
    );
    await Promise.resolve();
    expect(onUnsupported).not.toHaveBeenCalled();
  });

  it("reports NotSupportedError to the caller", async () => {
    const onUnsupported = vi.fn();
    playMediaElement(
      media(() => Promise.reject(new DOMException("no", "NotSupportedError"))),
      onUnsupported,
    );
    await Promise.resolve();
    expect(onUnsupported).toHaveBeenCalledTimes(1);
  });

  it("resolves a successful play()", async () => {
    const onUnsupported = vi.fn();
    playMediaElement(
      media(() => Promise.resolve()),
      onUnsupported,
    );
    await Promise.resolve();
    expect(onUnsupported).not.toHaveBeenCalled();
  });
});
