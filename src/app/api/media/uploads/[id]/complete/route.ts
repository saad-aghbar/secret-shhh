import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { unauthorized, validationError, internalError } from "@/lib/http/api-error";
import { MediaValidationError, completeMediaUpload } from "@/lib/media/service";
import { completeUploadSchema } from "@/lib/media/validation";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  const { id } = await params;
  if (!id) return validationError("Missing upload id.");

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return validationError("Invalid request.");
  }

  const parsed = completeUploadSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues[0]?.message ?? "Invalid request.");
  }

  try {
    const result = await completeMediaUpload({
      requestId,
      userId: session.user.id,
      uploadId: id,
      checksum: parsed.data.checksum,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof MediaValidationError) {
      return validationError(error.message);
    }
    logError({
      requestId,
      operation: "POST /api/media/uploads/[id]/complete",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
