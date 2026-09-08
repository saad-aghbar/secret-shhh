import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { internalError, unauthorized, validationError } from "@/lib/http/api-error";
import { logError } from "@/lib/logger";
import { MediaValidationError } from "@/lib/media/service";
import { initVideoUploadSchema } from "@/lib/media/validation";
import { initVideoUpload } from "@/lib/media/video-upload-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError("Invalid request.");
  }

  const parsed = initVideoUploadSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues[0]?.message ?? "Invalid upload request.");
  }

  try {
    const result = await initVideoUpload({
      requestId,
      userId: session.user.id,
      conversationId: session.conversationId,
      ...parsed.data,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof MediaValidationError) {
      return validationError(error.message);
    }
    logError({
      requestId,
      operation: "POST /api/media/video/uploads/init",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
