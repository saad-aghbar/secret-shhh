import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { mapAppearanceError } from "@/lib/appearance/errors";
import { completeWallpaperUpload } from "@/lib/appearance/service";
import { resolveAuthorizedSession } from "@/lib/auth/session";
import { unauthorized, validationError, internalError } from "@/lib/http/api-error";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  const { id } = await params;
  if (!id) return validationError("Couldn't save this photo. Try again.");

  try {
    const result = await completeWallpaperUpload({
      requestId,
      userId: session.user.id,
      assetId: id,
    });
    return NextResponse.json(result);
  } catch (error) {
    const mapped = mapAppearanceError(error);
    if (mapped) return mapped;
    logError({
      requestId,
      operation: "POST /api/appearance/wallpaper/uploads/[id]/complete",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
