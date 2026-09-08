import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { getMessagesAround } from "@/lib/chat/queries";
import { internalError, jsonError, unauthorized, validationError } from "@/lib/http/api-error";
import { logError } from "@/lib/logger";
import { messageContextQuerySchema } from "@/lib/search/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) {
    return unauthorized();
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return jsonError("NOT_FOUND", "Message not found.", 404);
  }

  const url = new URL(request.url);
  const parsed = messageContextQuerySchema.safeParse({
    before: url.searchParams.get("before") ?? undefined,
    after: url.searchParams.get("after") ?? undefined,
  });
  if (!parsed.success) {
    return validationError("Couldn’t load that message.");
  }

  try {
    const context = await getMessagesAround(
      session.conversationId,
      session.user.id,
      id,
      parsed.data,
    );
    if (!context.target) {
      // Generic — do not leak whether the id exists elsewhere.
      return jsonError("NOT_FOUND", "Message not found.", 404);
    }
    return NextResponse.json({
      target: context.target,
      before: context.before,
      after: context.after,
      olderCursor: context.olderCursor,
      newerCursor: context.newerCursor,
    });
  } catch (error) {
    logError({
      requestId,
      operation: "getMessageContext",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
