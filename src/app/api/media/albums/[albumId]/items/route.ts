import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { internalError, unauthorized, validationError } from "@/lib/http/api-error";
import { logError } from "@/lib/logger";
import { addAlbumItems, removeAlbumItems } from "@/lib/media/albums-service";
import { MediaValidationError } from "@/lib/media/service";
import { albumItemsSchema } from "@/lib/media/validation";
import { broadcastConversationEvent } from "@/lib/realtime/broadcast";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ albumId: string }> };

async function parseRequest(request: Request, context: RouteContext) {
  const { albumId } = await context.params;
  if (!z.string().uuid().safeParse(albumId).success) {
    return { error: validationError("That album isn't available.") } as const;
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { error: validationError("Choose at least one photo or video.") } as const;
  }
  const parsed = albumItemsSchema.safeParse(body);
  if (!parsed.success) {
    return { error: validationError("Choose at least one photo or video.") } as const;
  }
  return { albumId, mediaIds: parsed.data.mediaIds } as const;
}

export async function POST(request: Request, context: RouteContext) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  const parsed = await parseRequest(request, context);
  if ("error" in parsed) return parsed.error;

  try {
    const album = await addAlbumItems({
      requestId,
      conversationId: session.conversationId,
      userId: session.user.id,
      albumId: parsed.albumId,
      mediaIds: parsed.mediaIds,
    });
    void broadcastConversationEvent(session.conversationId, "album:changed", {
      albumId: parsed.albumId,
      action: "items_changed",
    });
    return NextResponse.json({ album });
  } catch (error) {
    if (error instanceof MediaValidationError) {
      return validationError(error.message);
    }
    logError({
      requestId,
      operation: "POST /api/media/albums/[albumId]/items",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}

/** Removes membership only. The original stays in chat and in All media. */
export async function DELETE(request: Request, context: RouteContext) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  const parsed = await parseRequest(request, context);
  if ("error" in parsed) return parsed.error;

  try {
    const album = await removeAlbumItems({
      requestId,
      conversationId: session.conversationId,
      userId: session.user.id,
      albumId: parsed.albumId,
      mediaIds: parsed.mediaIds,
    });
    void broadcastConversationEvent(session.conversationId, "album:changed", {
      albumId: parsed.albumId,
      action: "items_changed",
    });
    return NextResponse.json({ album });
  } catch (error) {
    if (error instanceof MediaValidationError) {
      return validationError(error.message);
    }
    logError({
      requestId,
      operation: "DELETE /api/media/albums/[albumId]/items",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
