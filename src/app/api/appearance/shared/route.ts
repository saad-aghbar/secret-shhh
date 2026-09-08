import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { mapAppearanceError } from "@/lib/appearance/errors";
import { clearSharedAppearance, saveSharedAppearance } from "@/lib/appearance/service";
import { resolveAuthorizedSession } from "@/lib/auth/session";
import { internalError, unauthorized, validationError } from "@/lib/http/api-error";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError("Couldn't save this look.");
  }

  try {
    const appearance = await saveSharedAppearance({
      requestId,
      userId: session.user.id,
      conversationId: session.conversationId,
      input: body,
    });
    return NextResponse.json(appearance);
  } catch (error) {
    const mapped = mapAppearanceError(error);
    if (mapped) return mapped;
    logError({
      requestId,
      operation: "PUT /api/appearance/shared",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}

export async function DELETE() {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  try {
    const appearance = await clearSharedAppearance({
      requestId,
      userId: session.user.id,
      conversationId: session.conversationId,
    });
    return NextResponse.json(appearance);
  } catch (error) {
    const mapped = mapAppearanceError(error);
    if (mapped) return mapped;
    logError({
      requestId,
      operation: "DELETE /api/appearance/shared",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
