import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { mapAppearanceError } from "@/lib/appearance/errors";
import { getAppearanceForUser } from "@/lib/appearance/service";
import { resolveAuthorizedSession } from "@/lib/auth/session";
import { internalError, unauthorized } from "@/lib/http/api-error";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  try {
    const appearance = await getAppearanceForUser({
      userId: session.user.id,
      conversationId: session.conversationId,
    });
    return NextResponse.json(appearance);
  } catch (error) {
    const mapped = mapAppearanceError(error);
    if (mapped) return mapped;
    logError({
      requestId,
      operation: "GET /api/appearance",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
