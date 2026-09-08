import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { internalError, unauthorized, validationError } from "@/lib/http/api-error";
import { logError } from "@/lib/logger";
import { MediaValidationError } from "@/lib/media/service";
import { signVideoPartsSchema } from "@/lib/media/validation";
import { signVideoParts } from "@/lib/media/video-upload-service";

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError("Invalid request.");
  }
  const parsed = signVideoPartsSchema.safeParse(body);
  if (!parsed.success) {
    return validationError("That video part isn't valid.");
  }

  try {
    const result = await signVideoParts({
      requestId,
      userId: session.user.id,
      sessionId,
      partNumbers: parsed.data.partNumbers,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof MediaValidationError) {
      return validationError(error.message);
    }
    logError({
      requestId,
      operation: "POST /api/media/video/uploads/[sessionId]/parts",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
