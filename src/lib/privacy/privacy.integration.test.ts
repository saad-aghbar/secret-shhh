import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { bootstrapUserBySlot, updateUserPasswordHash } from "@/lib/auth/bootstrap";
import { hashPassword } from "@/lib/auth/pin";
import { clearThrottle, throttleKey } from "@/lib/auth/rate-limit";
import { getDb } from "@/lib/db";
import { userPreferences } from "@/lib/db/schema";
import { getPrivacySettingsForUser } from "@/lib/privacy/preferences";
import { DEFAULT_PRIVACY_SETTINGS } from "@/lib/privacy/settings";
import { verifyUnlockPassword } from "@/lib/privacy/unlock";

const canRun = Boolean(process.env.DATABASE_URL);

describe.skipIf(!canRun)("privacy integration", () => {
  const ip = "privacy-test";

  afterEach(async () => {
    await clearThrottle(throttleKey("user_1", ip));
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const db = getDb();
    await db
      .update(userPreferences)
      .set({ ...DEFAULT_PRIVACY_SETTINGS, updatedAt: new Date() })
      .where(eq(userPreferences.userId, saad.user.id));
  });

  it("defaults to discreet mode and persists the four booleans", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const db = getDb();
    await db
      .update(userPreferences)
      .set({
        ...DEFAULT_PRIVACY_SETTINGS,
        updatedAt: new Date(),
      })
      .where(eq(userPreferences.userId, saad.user.id));
    const initial = await getPrivacySettingsForUser(saad.user.id);
    expect(initial.discreetMode).toBe(true);
    expect(initial.lockOnLeave).toBe(true);
    expect(initial.blurWhenHidden).toBe(true);
    expect(initial.showAppBadge).toBe(false);
    expect(initial).toEqual(DEFAULT_PRIVACY_SETTINGS);

    await db
      .update(userPreferences)
      .set({
        discreetMode: false,
        lockOnLeave: false,
        blurWhenHidden: false,
        showAppBadge: true,
        updatedAt: new Date(),
      })
      .where(eq(userPreferences.userId, saad.user.id));

    expect(await getPrivacySettingsForUser(saad.user.id)).toEqual({
      discreetMode: false,
      lockOnLeave: false,
      blurWhenHidden: false,
      showAppBadge: true,
    });
  });

  it("rejects a wrong password, throttles, then unlocks with the account password", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const previousHash = saad.user.passwordHash;
    await updateUserPasswordHash(saad.user.id, await hashPassword("unlock-ok"));
    const session = {
      ...saad,
      sessionId: "privacy-unlock",
      slot: "user_1" as const,
    };

    try {
      const wrong = await verifyUnlockPassword({
        session,
        password: "nope",
        ip,
      });
      expect(wrong).toEqual({ ok: false, error: "That password isn’t right." });

      for (let i = 0; i < 4; i += 1) {
        await verifyUnlockPassword({ session, password: "nope", ip });
      }
      const throttled = await verifyUnlockPassword({ session, password: "nope", ip });
      expect(throttled).toEqual({ ok: false, error: "Try again in a moment." });

      await clearThrottle(throttleKey("user_1", ip));
      const ok = await verifyUnlockPassword({
        session,
        password: "unlock-ok",
        ip,
      });
      expect(ok).toEqual({ ok: true });
    } finally {
      if (previousHash) {
        await updateUserPasswordHash(saad.user.id, previousHash);
      }
    }
  });
});
