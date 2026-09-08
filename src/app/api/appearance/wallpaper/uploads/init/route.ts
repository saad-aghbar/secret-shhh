import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { mapAppearanceError } from "@/lib/appearance/errors";
import { initWallpaperUpload } from "@/lib/appearance/service";
import { initWallpaperUploadSchema } from "@/lib/appearance/validation";
import { resolveAuthorizedSession } from "@/lib/auth/session";
import { internalError, rateLimited, unauthorized, validationError } from "@/lib/http/api-error";
import { RouteRateLimitError } from "@/lib/http/route-rate-limit-error";
import { assertRouteRateLimit } from "@/lib/http/route-rate-limit";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError("Couldn't save this photo. Try again.");
  }

  const parsed = initWallpaperUploadSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues[0]?.message ?? "Couldn't save this photo. Try again.");
  }

  try {
    await assertRouteRateLimit({
      key: `wallpaper-init:${session.user.id}`,
      max: 80,
      message: "Wait a moment, then try that photo again.",
    });
    const result = await initWallpaperUpload({
      requestId,
      userId: session.user.id,
      conversationId: session.conversationId,
      ...parsed.data,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RouteRateLimitError) {
      return rateLimited(error.message);
    }
    const mapped = mapAppearanceError(error);
    if (mapped) return mapped;
    logError({
      requestId,
      operation: "POST /api/appearance/wallpaper/uploads/init",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
