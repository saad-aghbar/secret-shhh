import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { markMessagesDelivered } from "@/lib/chat/receipts";
import { internalError, unauthorized, validationError } from "@/lib/http/api-error";
import { logError } from "@/lib/logger";
import { markDeliveredSchema } from "@/lib/validation/chat";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) {
    return unauthorized();
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return validationError();
  }

  const parsed = markDeliveredSchema.safeParse(json);
  if (!parsed.success) {
    return validationError();
  }

  try {
    const result = await markMessagesDelivered({
      requestId,
      userId: session.user.id,
      conversationId: session.conversationId,
      messageIds: parsed.data.messageIds,
    });
    return NextResponse.json(result);
  } catch (error) {
    logError({
      requestId,
      operation: "markDelivered",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
