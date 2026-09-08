import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { mapAppearanceError } from "@/lib/appearance/errors";
import { createWallpaperReadUrl } from "@/lib/appearance/service";
import { resolveAuthorizedSession } from "@/lib/auth/session";
import { unauthorized, validationError, internalError } from "@/lib/http/api-error";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ assetId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  const { assetId } = await params;
  if (!z.string().uuid().safeParse(assetId).success) {
    return validationError("That background isn't here anymore.");
  }

  try {
    const result = await createWallpaperReadUrl({
      requestId,
      userId: session.user.id,
      conversationId: session.conversationId,
      assetId,
    });
    return NextResponse.json(result);
  } catch (error) {
    const mapped = mapAppearanceError(error);
    if (mapped) return mapped;
    logError({
      requestId,
      operation: "GET /api/appearance/wallpaper/[assetId]/url",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
