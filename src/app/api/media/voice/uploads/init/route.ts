import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { unauthorized, validationError, internalError } from "@/lib/http/api-error";
import { MediaValidationError, initVoiceUpload } from "@/lib/media/service";
import { initVoiceUploadSchema } from "@/lib/media/validation";
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
    return validationError("Invalid request.");
  }

  const parsed = initVoiceUploadSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues[0]?.message ?? "Invalid voice message.");
  }

  try {
    const result = await initVoiceUpload({
      requestId,
      userId: session.user.id,
      conversationId: session.conversationId,
      clientGeneratedId: parsed.data.clientGeneratedId,
      clientAssetId: parsed.data.clientAssetId,
      mediaFolderId: parsed.data.mediaFolderId,
      mimeType: parsed.data.mimeType,
      size: parsed.data.size,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof MediaValidationError) {
      return validationError(error.message);
    }
    logError({
      requestId,
      operation: "POST /api/media/voice/uploads/init",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
