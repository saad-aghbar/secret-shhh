import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { mapAppearanceError } from "@/lib/appearance/errors";
import { putWallpaperUploadContent } from "@/lib/appearance/service";
import { resolveAuthorizedSession } from "@/lib/auth/session";
import { unauthorized, validationError, internalError, jsonError } from "@/lib/http/api-error";
import { logError } from "@/lib/logger";
import { getStorageProviderName } from "@/lib/storage";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  if (getStorageProviderName() === "r2") {
    return jsonError("NOT_FOUND", "Not found.", 404);
  }
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  const { id } = await params;
  if (!id) return validationError("Couldn't save this photo. Try again.");

  try {
    const contentType = request.headers.get("content-type") ?? undefined;
    const body = new Uint8Array(await request.arrayBuffer());
    await putWallpaperUploadContent({
      requestId,
      userId: session.user.id,
      assetId: id,
      body,
      contentType,
    });
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    const mapped = mapAppearanceError(error);
    if (mapped) return mapped;
    logError({
      requestId,
      operation: "PUT /api/appearance/wallpaper/uploads/[id]/content",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
