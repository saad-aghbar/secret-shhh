import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { forbidden, internalError, jsonError, unauthorized, validationError } from "@/lib/http/api-error";
import { logError } from "@/lib/logger";
import { DoodleForbiddenError, DoodleNotFoundError, getDoodleForViewer } from "@/lib/doodles/service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return validationError("Couldn't find that doodle.");
  }

  try {
    const doodle = await getDoodleForViewer({
      doodleId: id,
      userId: session.user.id,
      conversationId: session.conversationId,
    });
    return NextResponse.json({ doodle });
  } catch (error) {
    if (error instanceof DoodleNotFoundError) {
      return jsonError("NOT_FOUND", error.message, 404);
    }
    if (error instanceof DoodleForbiddenError) {
      return forbidden();
    }
    logError({
      requestId,
      operation: "GET /api/doodles/[id]",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
