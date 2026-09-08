import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { internalError, unauthorized, validationError } from "@/lib/http/api-error";
import { logError } from "@/lib/logger";
import { setMediaFavorite } from "@/lib/media/favorites-service";
import { MediaValidationError } from "@/lib/media/service";
import { broadcastConversationEvent } from "@/lib/realtime/broadcast";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

async function toggle(context: RouteContext, favorite: boolean) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return validationError("That isn't available.");
  }

  try {
    const state = await setMediaFavorite({
      requestId,
      userId: session.user.id,
      conversationId: session.conversationId,
      mediaId: id,
      favorite,
    });
    void broadcastConversationEvent(session.conversationId, "favorite:changed", {
      mediaId: id,
    });
    return NextResponse.json(state);
  } catch (error) {
    if (error instanceof MediaValidationError) {
      return validationError(error.message);
    }
    logError({
      requestId,
      operation: "media favorite",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}

export async function PUT(_request: Request, context: RouteContext) {
  return toggle(context, true);
}

export async function DELETE(_request: Request, context: RouteContext) {
  return toggle(context, false);
}
