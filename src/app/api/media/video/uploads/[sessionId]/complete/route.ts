import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { forbidden, internalError, unauthorized, validationError } from "@/lib/http/api-error";
import { logError } from "@/lib/logger";
import { MediaValidationError } from "@/lib/media/service";
import { finalizeVideoMessageSchema } from "@/lib/media/validation";
import { completeVideoUploadAndFinalize } from "@/lib/media/video-upload-service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ sessionId: string }> };

const sessionIdSchema = z.string().uuid();

export async function POST(request: Request, { params }: Params) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  const { sessionId } = await params;
  if (!sessionIdSchema.safeParse(sessionId).success) {
    return validationError("Upload not found.");
  }

  let body: unknown = {};
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return validationError("Invalid request.");
  }
  const parsed = finalizeVideoMessageSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues[0]?.message ?? "Invalid request.");
  }

  try {
    const message = await completeVideoUploadAndFinalize({
      requestId,
      userId: session.user.id,
      conversationId: session.conversationId,
      sessionId,
      ...parsed.data,
    });
    return NextResponse.json({ message });
  } catch (error) {
    if (error instanceof MediaValidationError) {
      if (error.message.includes("already part")) return forbidden();
      return validationError(error.message);
    }
    logError({
      requestId,
      operation: "POST /api/media/video/uploads/[sessionId]/complete",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
