import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { internalError, unauthorized, validationError } from "@/lib/http/api-error";
import { logError } from "@/lib/logger";
import { listReadyMediaForMessage } from "@/lib/media/service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ messageId: string }> };

/** Attachments of one chat message — powers album-aware viewer navigation. */
export async function GET(_request: Request, context: RouteContext) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  const { messageId } = await context.params;
  if (!z.string().uuid().safeParse(messageId).success) {
    return validationError("That isn't available.");
  }

  try {
    const media = await listReadyMediaForMessage({
      conversationId: session.conversationId,
      messageId,
    });
    return NextResponse.json({ messageId, media });
  } catch (error) {
    logError({
      requestId,
      operation: "GET /api/media/messages/[messageId]/attachments",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
