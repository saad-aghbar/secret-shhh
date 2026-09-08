import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { internalError, unauthorized, validationError } from "@/lib/http/api-error";
import { logError } from "@/lib/logger";
import { reorderAlbumItems } from "@/lib/media/albums-service";
import { MediaValidationError } from "@/lib/media/service";
import { albumOrderSchema } from "@/lib/media/validation";
import { broadcastConversationEvent } from "@/lib/realtime/broadcast";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ albumId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  const { albumId } = await context.params;
  if (!z.string().uuid().safeParse(albumId).success) {
    return validationError("That album isn't available.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError("Couldn't save that order.");
  }

  const parsed = albumOrderSchema.safeParse(body);
  if (!parsed.success) {
    return validationError("Couldn't save that order.");
  }

  try {
    const album = await reorderAlbumItems({
      requestId,
      conversationId: session.conversationId,
      userId: session.user.id,
      albumId,
      mediaIds: parsed.data.mediaIds,
    });
    void broadcastConversationEvent(session.conversationId, "album:changed", {
      albumId,
      action: "items_changed",
    });
    return NextResponse.json({ album });
  } catch (error) {
    if (error instanceof MediaValidationError) {
      return validationError(error.message);
    }
    logError({
      requestId,
      operation: "PATCH /api/media/albums/[albumId]/items/order",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
