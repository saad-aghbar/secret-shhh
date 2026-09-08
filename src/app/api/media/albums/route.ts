import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { internalError, unauthorized, validationError } from "@/lib/http/api-error";
import { logError } from "@/lib/logger";
import { createSharedAlbum, listSharedAlbums } from "@/lib/media/albums-service";
import { MediaValidationError } from "@/lib/media/service";
import { createAlbumSchema } from "@/lib/media/validation";
import { broadcastConversationEvent } from "@/lib/realtime/broadcast";

export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  try {
    const albums = await listSharedAlbums({
      requestId,
      conversationId: session.conversationId,
      userId: session.user.id,
    });
    return NextResponse.json({ albums });
  } catch (error) {
    logError({
      requestId,
      operation: "GET /api/media/albums",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError("Couldn't create that album.");
  }

  const parsed = createAlbumSchema.safeParse(body);
  if (!parsed.success) {
    return validationError("Couldn't create that album.");
  }

  try {
    const album = await createSharedAlbum({
      requestId,
      conversationId: session.conversationId,
      userId: session.user.id,
      title: parsed.data.title,
      note: parsed.data.note ?? null,
      mediaIds: parsed.data.mediaIds,
    });
    void broadcastConversationEvent(session.conversationId, "album:changed", {
      albumId: album.id,
      action: "created",
    });
    return NextResponse.json({ album });
  } catch (error) {
    if (error instanceof MediaValidationError) {
      return validationError(error.message);
    }
    logError({
      requestId,
      operation: "POST /api/media/albums",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
