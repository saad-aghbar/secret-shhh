import { eq } from "drizzle-orm";

import { isEmptyThemeRecord, type ThemeMode, type ThemePreference } from "@/lib/theme/config";
import { resolveTheme } from "@/lib/theme/resolve";
import type { ThemePayload } from "@/lib/theme/types";
import { parseThemeConfig, parseThemePreference } from "@/lib/theme/validation";
import { getDb } from "@/lib/db";
import { userPreferences } from "@/lib/db/schema";
import { logInfo } from "@/lib/logger";

async function loadPreferences(userId: string) {
  const db = getDb();
  const existing = (
    await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1)
  )[0];
  if (existing) return existing;
  const [created] = await db.insert(userPreferences).values({ userId }).returning();
  return created;
}

function storedConfig(value: unknown, mode: ThemeMode): ThemePayload["light"] {
  if (isEmptyThemeRecord(value)) return {};
  const resolved = resolveTheme({ stored: value, mode });
  return resolved.isDefault && isEmptyThemeRecord(value) ? {} : resolved.config;
}

export async function getThemeForUser(userId: string): Promise<ThemePayload> {
  const row = await loadPreferences(userId);
  const light = resolveTheme({ stored: row.themeLight ?? {}, mode: "light" });
  const dark = resolveTheme({ stored: row.themeDark ?? {}, mode: "dark" });
  return {
    mode: parseThemePreference(row.theme),
    light: storedConfig(row.themeLight, "light"),
    dark: storedConfig(row.themeDark, "dark"),
    resolvedLight: light,
    resolvedDark: dark,
  };
}

export async function saveThemeConfig(params: {
  requestId: string;
  userId: string;
  target: ThemeMode;
  input: unknown;
}): Promise<ThemePayload> {
  const config = parseThemeConfig(params.input, params.target);
  const db = getDb();
  const column = params.target === "light" ? "themeLight" : "themeDark";
  await db
    .insert(userPreferences)
    .values({
      userId: params.userId,
      [column]: config,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { [column]: config, updatedAt: new Date() },
    });
  logInfo({
    requestId: params.requestId,
    operation: "saveThemeConfig",
    userId: params.userId,
    extra: { target: params.target, preset: config.preset },
  });
  return getThemeForUser(params.userId);
}

export async function resetThemeConfig(params: {
  requestId: string;
  userId: string;
  target: ThemeMode;
}): Promise<ThemePayload> {
  const db = getDb();
  const column = params.target === "light" ? "themeLight" : "themeDark";
  await db
    .insert(userPreferences)
    .values({
      userId: params.userId,
      [column]: {},
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { [column]: {}, updatedAt: new Date() },
    });
  logInfo({
    requestId: params.requestId,
    operation: "resetThemeConfig",
    userId: params.userId,
    extra: { target: params.target },
  });
  return getThemeForUser(params.userId);
}

export async function saveThemeMode(params: {
  requestId: string;
  userId: string;
  mode: ThemePreference;
}): Promise<ThemePayload> {
  const db = getDb();
  await db
    .insert(userPreferences)
    .values({
      userId: params.userId,
      theme: params.mode,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { theme: params.mode, updatedAt: new Date() },
    });
  logInfo({
    requestId: params.requestId,
    operation: "saveThemeMode",
    userId: params.userId,
    extra: { mode: params.mode },
  });
  return getThemeForUser(params.userId);
}

export function emptyThemePayload(mode: ThemePreference = "system"): ThemePayload {
  const light = resolveTheme({ stored: {}, mode: "light" });
  const dark = resolveTheme({ stored: {}, mode: "dark" });
  return {
    mode,
    light: {},
    dark: {},
    resolvedLight: light,
    resolvedDark: dark,
  };
}

