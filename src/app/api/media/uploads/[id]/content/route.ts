import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { unauthorized, validationError, internalError, jsonError } from "@/lib/http/api-error";
import { MediaValidationError, putMediaUploadContent } from "@/lib/media/service";
import { logError } from "@/lib/logger";
import { getStorageProviderName } from "@/lib/storage";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Local/test fallback only. Production R2 uploads use signed PUT URLs.
 */
export async function PUT(request: Request, { params }: Params) {
  if (getStorageProviderName() === "r2") {
    return jsonError("NOT_FOUND", "Not found.", 404);
  }
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  const { id } = await params;
  if (!id) return validationError("Missing upload id.");

  try {
    const contentType = request.headers.get("content-type") ?? undefined;
    const body = new Uint8Array(await request.arrayBuffer());
    await putMediaUploadContent({
      requestId,
      userId: session.user.id,
      uploadId: id,
      body,
      contentType,
    });
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    if (error instanceof MediaValidationError) {
      if (error.message.includes("not found")) {
        return jsonError("NOT_FOUND", error.message, 404);
      }
      return validationError(error.message);
    }
    logError({
      requestId,
      operation: "PUT /api/media/uploads/[id]/content",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
