import { afterEach, describe, expect, it } from "vitest";

import { claimCallTab, clearCallTab, ownsCallTab } from "@/lib/calls/tab-owner";

describe("call tab owner", () => {
  afterEach(() => {
    clearCallTab();
  });

  it("claims only the current tab", () => {
    expect(ownsCallTab("call-1")).toBe(false);
    claimCallTab("call-1");
    expect(ownsCallTab("call-1")).toBe(true);
    expect(ownsCallTab("call-2")).toBe(false);
    clearCallTab("call-1");
    expect(ownsCallTab("call-1")).toBe(false);
  });
});
