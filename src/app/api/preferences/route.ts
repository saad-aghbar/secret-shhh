import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { userPreferences } from "@/lib/db/schema";
import { internalError, unauthorized, validationError } from "@/lib/http/api-error";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  autoDownloadPhotos: z.enum(["always", "good_connection", "never"]).optional(),
  lowDataMode: z.boolean().optional(),
  voicePlaybackRate: z.enum(["1", "1.5", "2"]).optional(),
  discreetMode: z.boolean().optional(),
  lockOnLeave: z.boolean().optional(),
  blurWhenHidden: z.boolean().optional(),
  showAppBadge: z.boolean().optional(),
});

function readVoiceRate(ui: Record<string, unknown> | null): "1" | "1.5" | "2" {
  const value = ui?.voicePlaybackRate;
  return value === "1.5" || value === "2" ? value : "1";
}

function responseShape(row: typeof userPreferences.$inferSelect) {
  return {
    autoDownloadPhotos: row.autoDownloadPhotos,
    lowDataMode: row.lowDataMode,
    voicePlaybackRate: readVoiceRate(row.uiPreferences),
    discreetMode: row.discreetMode,
    lockOnLeave: row.lockOnLeave,
    blurWhenHidden: row.blurWhenHidden,
    showAppBadge: row.showAppBadge,
  };
}

export async function GET() {
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();
  try {
    const db = getDb();
    const row = (
      await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, session.user.id))
        .limit(1)
    )[0];
    if (row) return NextResponse.json(responseShape(row));
    const [created] = await db
      .insert(userPreferences)
      .values({ userId: session.user.id })
      .returning();
    return NextResponse.json(responseShape(created));
  } catch {
    return internalError();
  }
}

export async function PATCH(request: Request) {
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError("Invalid preferences.");
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return validationError("Invalid preferences.");
  }
  const { voicePlaybackRate, ...columns } = parsed.data;
  try {
    const db = getDb();
    // Voice speed lives in the `ui_preferences` blob; merge so it cannot clobber
    // whatever else later phases keep in there.
    const uiPatch = voicePlaybackRate
      ? {
          uiPreferences: sql`coalesce(${userPreferences.uiPreferences}, '{}'::jsonb) || ${JSON.stringify(
            { voicePlaybackRate },
          )}::jsonb`,
        }
      : {};
    const [row] = await db
      .insert(userPreferences)
      .values({
        userId: session.user.id,
        ...columns,
        ...(voicePlaybackRate ? { uiPreferences: { voicePlaybackRate } } : {}),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: { ...columns, ...uiPatch, updatedAt: new Date() },
      })
      .returning();
    return NextResponse.json(responseShape(row));
  } catch {
    return internalError();
  }
}
