import { describe, expect, it } from "vitest";

import { DEFAULT_PRIVACY_SETTINGS, normalizePrivacySettings } from "@/lib/privacy/settings";
import { lockCookieOptions, LOCK_COOKIE } from "@/lib/privacy/lock-cookie";

describe("privacy settings defaults", () => {
  it("starts discreet with no badge", () => {
    expect(DEFAULT_PRIVACY_SETTINGS).toEqual({
      discreetMode: true,
      lockOnLeave: true,
      blurWhenHidden: true,
      showAppBadge: false,
    });
    expect(normalizePrivacySettings({})).toEqual(DEFAULT_PRIVACY_SETTINGS);
  });
});

describe("lock cookies", () => {
  it("are httpOnly session cookies scoped to the app", () => {
    expect(LOCK_COOKIE).toBe("shhh_lock");
    const set = lockCookieOptions(60);
    expect(set.httpOnly).toBe(true);
    expect(set.sameSite).toBe("lax");
    expect(set.path).toBe("/");
    expect(set.maxAge).toBe(60);
    expect(lockCookieOptions(0).maxAge).toBe(0);
  });
});
