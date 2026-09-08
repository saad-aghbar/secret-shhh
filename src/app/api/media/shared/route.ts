import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { internalError, unauthorized, validationError } from "@/lib/http/api-error";
import { logError } from "@/lib/logger";
import { listSharedConversationMedia } from "@/lib/media/service";
import { sharedMediaQuerySchema } from "@/lib/media/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  const url = new URL(request.url);
  const parsed = sharedMediaQuerySchema.safeParse({
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    sender: url.searchParams.get("sender") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    favorites: url.searchParams.get("favorites") ?? undefined,
    sort: url.searchParams.get("sort") ?? undefined,
    tz: url.searchParams.get("tz") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
  });
  if (!parsed.success) {
    return validationError("Couldn't load that.");
  }

  // A sender id from the client is only ever a filter, never an authorization input.
  const senderId =
    parsed.data.sender === session.user.id || parsed.data.sender === session.partner?.id
      ? parsed.data.sender
      : undefined;

  try {
    const page = await listSharedConversationMedia({
      requestId,
      conversationId: session.conversationId,
      userId: session.user.id,
      cursor: parsed.data.cursor,
      limit: parsed.data.limit,
      senderId,
      from: parsed.data.from,
      to: parsed.data.to,
      timeZone: parsed.data.tz,
      favorites: parsed.data.favorites,
      sort: parsed.data.sort,
      mediaType: parsed.data.type === "all" ? "all" : parsed.data.type,
    });
    return NextResponse.json(page);
  } catch (error) {
    logError({
      requestId,
      operation: "GET /api/media/shared",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
