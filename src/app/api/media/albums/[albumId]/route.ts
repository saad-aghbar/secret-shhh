import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { internalError, unauthorized, validationError } from "@/lib/http/api-error";
import { logError } from "@/lib/logger";
import {
  deleteSharedAlbum,
  getSharedAlbum,
  updateSharedAlbum,
} from "@/lib/media/albums-service";
import { MediaValidationError } from "@/lib/media/service";
import { updateAlbumSchema } from "@/lib/media/validation";
import { broadcastConversationEvent } from "@/lib/realtime/broadcast";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ albumId: string }> };

async function readAlbumId(context: RouteContext) {
  const { albumId } = await context.params;
  return z.string().uuid().safeParse(albumId).success ? albumId : null;
}

export async function GET(_request: Request, context: RouteContext) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  const albumId = await readAlbumId(context);
  if (!albumId) return validationError("That album isn't available.");

  try {
    const album = await getSharedAlbum({
      requestId,
      conversationId: session.conversationId,
      userId: session.user.id,
      albumId,
    });
    return NextResponse.json({ album });
  } catch (error) {
    if (error instanceof MediaValidationError) {
      return validationError(error.message);
    }
    logError({
      requestId,
      operation: "GET /api/media/albums/[albumId]",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  const albumId = await readAlbumId(context);
  if (!albumId) return validationError("That album isn't available.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError("Couldn't update the album.");
  }

  const parsed = updateAlbumSchema.safeParse(body);
  if (!parsed.success) {
    return validationError("Couldn't update the album.");
  }

  try {
    const album = await updateSharedAlbum({
      requestId,
      conversationId: session.conversationId,
      userId: session.user.id,
      albumId,
      ...parsed.data,
    });
    void broadcastConversationEvent(session.conversationId, "album:changed", {
      albumId,
      action: "updated",
    });
    return NextResponse.json({ album });
  } catch (error) {
    if (error instanceof MediaValidationError) {
      return validationError(error.message);
    }
    logError({
      requestId,
      operation: "PATCH /api/media/albums/[albumId]",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  const albumId = await readAlbumId(context);
  if (!albumId) return validationError("That album isn't available.");

  try {
    // Removes the album and its memberships only — chat photos are untouched.
    const result = await deleteSharedAlbum({
      requestId,
      conversationId: session.conversationId,
      userId: session.user.id,
      albumId,
    });
    void broadcastConversationEvent(session.conversationId, "album:changed", {
      albumId,
      action: "deleted",
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof MediaValidationError) {
      return validationError(error.message);
    }
    logError({
      requestId,
      operation: "DELETE /api/media/albums/[albumId]",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
