import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { internalError, unauthorized, validationError } from "@/lib/http/api-error";
import { logError } from "@/lib/logger";
import { MediaValidationError } from "@/lib/media/service";
import { getVideoUploadSession } from "@/lib/media/video-upload-service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ sessionId: string }> };

const sessionIdSchema = z.string().uuid();

export async function GET(_request: Request, { params }: Params) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  const { sessionId } = await params;
  if (!sessionIdSchema.safeParse(sessionId).success) {
    return validationError("Upload not found.");
  }

  try {
    const result = await getVideoUploadSession({
      requestId,
      userId: session.user.id,
      sessionId,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof MediaValidationError) {
      return validationError(error.message);
    }
    logError({
      requestId,
      operation: "GET /api/media/video/uploads/[sessionId]",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
