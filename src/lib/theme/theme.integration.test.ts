import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { bootstrapUserBySlot } from "@/lib/auth/bootstrap";
import { getDb } from "@/lib/db";
import { userPreferences } from "@/lib/db/schema";
import { getThemeForUser, resetThemeConfig, saveThemeConfig, saveThemeMode } from "@/lib/theme/service";
import { ThemeValidationError } from "@/lib/theme/validation";

const canRun = Boolean(process.env.DATABASE_URL);

async function resetThemes() {
  const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
  const tala = await bootstrapUserBySlot({ slot: "user_2", displayName: "Tala" });
  const db = getDb();
  await db
    .update(userPreferences)
    .set({ themeLight: {}, themeDark: {}, theme: "system" })
    .where(eq(userPreferences.userId, saad.user.id));
  await db
    .update(userPreferences)
    .set({ themeLight: {}, themeDark: {}, theme: "system" })
    .where(eq(userPreferences.userId, tala.user.id));
}

describe.skipIf(!canRun)("phase 11 theme integration", { timeout: 20_000 }, () => {
  beforeEach(async () => {
    await resetThemes();
  });

  afterAll(async () => {
    if (canRun) await resetThemes();
  });

  it("persists Light and Dark independently and isolates Saad from Tala", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const tala = await bootstrapUserBySlot({ slot: "user_2", displayName: "Tala" });

    await saveThemeConfig({
      requestId: "t1",
      userId: saad.user.id,
      target: "light",
      input: { version: 1, preset: "blush", colors: { outgoing: "#7eb8ff" } },
    });
    await saveThemeConfig({
      requestId: "t2",
      userId: saad.user.id,
      target: "dark",
      input: { version: 1, preset: "midnight", colors: { accent: "#d4a090" } },
    });

    const saadTheme = await getThemeForUser(saad.user.id);
    const talaTheme = await getThemeForUser(tala.user.id);

    expect(saadTheme.resolvedLight.tokens.outgoing).toBe("#7eb8ff");
    expect(saadTheme.resolvedDark.tokens.accent).toBe("#d4a090");
    expect(saadTheme.resolvedLight.tokens.accent).not.toBe(saadTheme.resolvedDark.tokens.accent);
    expect(talaTheme.resolvedLight.isDefault).toBe(true);
    expect(talaTheme.resolvedDark.isDefault).toBe(true);
  });

  it("saves one coherent object and can reset a single mode", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    await saveThemeConfig({
      requestId: "t3",
      userId: saad.user.id,
      target: "light",
      input: { version: 1, preset: "ocean", colors: { accent: "#3d6d7e", background: "#eef3f5" } },
    });
    const saved = await getThemeForUser(saad.user.id);
    expect(saved.resolvedLight.presetId).toBe("ocean");
    expect(saved.resolvedLight.authored.accent).toBe("#3d6d7e");

    await resetThemeConfig({ requestId: "t4", userId: saad.user.id, target: "light" });
    const reset = await getThemeForUser(saad.user.id);
    expect(reset.resolvedLight.isDefault).toBe(true);
    expect(reset.light).toEqual({});
  });

  it("persists the Light / Dark / System preference", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    await saveThemeMode({ requestId: "t5", userId: saad.user.id, mode: "dark" });
    expect((await getThemeForUser(saad.user.id)).mode).toBe("dark");
  });

  it("rejects hostile payloads in a single write", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    await expect(
      saveThemeConfig({
        requestId: "t6",
        userId: saad.user.id,
        target: "light",
        input: { version: 1, preset: "shhh", colors: { accent: "url(javascript:alert(1))" } },
      }),
    ).rejects.toBeInstanceOf(ThemeValidationError);
  });
});
