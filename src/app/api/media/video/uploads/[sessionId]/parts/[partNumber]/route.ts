import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { internalError, unauthorized, validationError } from "@/lib/http/api-error";
import { logError } from "@/lib/logger";
import { MediaValidationError } from "@/lib/media/service";
import { recordVideoPartSchema } from "@/lib/media/validation";
import { recordVideoPart } from "@/lib/media/video-upload-service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ sessionId: string; partNumber: string }> };

const sessionIdSchema = z.string().uuid();
const partNumberSchema = z.coerce.number().int().positive().max(10_000);

export async function PUT(request: Request, { params }: Params) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  const { sessionId, partNumber: rawPart } = await params;
  if (!sessionIdSchema.safeParse(sessionId).success) {
    return validationError("Upload not found.");
  }
  const partNumber = partNumberSchema.safeParse(rawPart);
  if (!partNumber.success) {
    return validationError("That video part isn't valid.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError("Invalid request.");
  }
  const parsed = recordVideoPartSchema.safeParse(body);
  if (!parsed.success) {
    return validationError("Couldn't send · Tap to retry");
  }

  try {
    const result = await recordVideoPart({
      requestId,
      userId: session.user.id,
      sessionId,
      partNumber: partNumber.data,
      etag: parsed.data.etag,
      sizeBytes: parsed.data.sizeBytes,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof MediaValidationError) {
      return validationError(error.message);
    }
    logError({
      requestId,
      operation: "PUT /api/media/video/uploads/[sessionId]/parts/[partNumber]",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
