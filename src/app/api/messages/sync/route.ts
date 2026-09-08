import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { getMessagesAfter } from "@/lib/chat/queries";
import { internalError, unauthorized, validationError } from "@/lib/http/api-error";
import { logError } from "@/lib/logger";
import { cursorQuerySchema } from "@/lib/validation/chat";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const after = url.searchParams.get("after");
  const parsed = cursorQuerySchema.safeParse({
    cursor: after ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success || !parsed.data.cursor) {
    return validationError("Couldn’t sync messages.");
  }

  try {
    const page = await getMessagesAfter(
      session.conversationId,
      session.user.id,
      parsed.data.cursor,
      parsed.data.limit,
    );
    return NextResponse.json(page);
  } catch (error) {
    logError({
      requestId,
      operation: "syncMessages",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
