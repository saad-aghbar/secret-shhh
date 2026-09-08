import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { internalError, unauthorized, validationError } from "@/lib/http/api-error";
import { logError } from "@/lib/logger";
import { searchMessages } from "@/lib/search/query";
import { searchMessagesQuerySchema } from "@/lib/search/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const parsed = searchMessagesQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    sender: url.searchParams.get("sender") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    tz: url.searchParams.get("tz") ?? undefined,
  });
  if (!parsed.success) {
    return validationError("Couldn’t run that search.");
  }

  try {
    const page = await searchMessages({
      requestId,
      conversationId: session.conversationId,
      viewerId: session.user.id,
      query: parsed.data,
    });
    return NextResponse.json(page);
  } catch (error) {
    logError({
      requestId,
      operation: "searchMessages",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
