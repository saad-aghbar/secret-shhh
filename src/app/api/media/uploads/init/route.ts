import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { unauthorized, validationError, internalError, rateLimited } from "@/lib/http/api-error";
import { RouteRateLimitError } from "@/lib/http/route-rate-limit-error";
import { assertRouteRateLimit } from "@/lib/http/route-rate-limit";
import { MediaValidationError, initMediaUpload } from "@/lib/media/service";
import { initUploadSchema } from "@/lib/media/validation";
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

  const parsed = initUploadSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues[0]?.message ?? "Invalid upload request.");
  }

  try {
    await assertRouteRateLimit({
      key: `upload-init:${session.user.id}`,
      max: 300,
      message: "Wait a moment, then try that upload again.",
    });
    const result = await initMediaUpload({
      requestId,
      userId: session.user.id,
      conversationId: session.conversationId,
      ...parsed.data,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RouteRateLimitError) {
      return rateLimited(error.message);
    }
    if (error instanceof MediaValidationError) {
      return validationError(error.message);
    }
    logError({
      requestId,
      operation: "POST /api/media/uploads/init",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
