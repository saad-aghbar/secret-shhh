import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { unauthorized, validationError, internalError, forbidden } from "@/lib/http/api-error";
import { MediaValidationError, cancelMediaUpload } from "@/lib/media/service";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  const { id } = await params;
  if (!id) return validationError("Missing upload id.");

  try {
    const result = await cancelMediaUpload({
      requestId,
      userId: session.user.id,
      uploadId: id,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof MediaValidationError) {
      if (error.message.includes("already part")) return forbidden();
      return validationError(error.message);
    }
    logError({
      requestId,
      operation: "POST /api/media/uploads/[id]/cancel",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
