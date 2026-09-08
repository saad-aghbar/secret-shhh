import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { userPreferences } from "@/lib/db/schema";
import {
  DEFAULT_PRIVACY_SETTINGS,
  normalizePrivacySettings,
  type PrivacySettings,
} from "@/lib/privacy/settings";

export function privacyFromRow(
  row:
    | {
        discreetMode: boolean;
        lockOnLeave: boolean;
        blurWhenHidden: boolean;
        showAppBadge: boolean;
      }
    | null
    | undefined,
): PrivacySettings {
  if (!row) return DEFAULT_PRIVACY_SETTINGS;
  return normalizePrivacySettings(row);
}

export async function getPrivacySettingsForUser(userId: string): Promise<PrivacySettings> {
  const db = getDb();
  const row = (
    await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1)
  )[0];
  return privacyFromRow(row);
}
