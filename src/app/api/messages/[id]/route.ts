import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import {
  deleteMessage,
  editMessage,
  InteractionError,
} from "@/lib/chat/interactions";
import { jsonError, internalError, unauthorized, validationError } from "@/lib/http/api-error";
import { logError } from "@/lib/logger";
import { editMessageSchema } from "@/lib/validation/chat";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function asMessageId(id: string) {
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

export async function PATCH(request: Request, { params }: Params) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) {
    return unauthorized();
  }

  const { id } = await params;
  const messageId = asMessageId(id);
  if (!messageId) {
    return jsonError("NOT_FOUND", "Message not found.", 404);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return validationError("That message couldn’t be edited.");
  }

  const parsed = editMessageSchema.safeParse(json);
  if (!parsed.success) {
    return validationError(parsed.error.issues[0]?.message ?? "That message couldn’t be edited.");
  }

  try {
    const message = await editMessage({
      requestId,
      userId: session.user.id,
      conversationId: session.conversationId,
      messageId,
      text: parsed.data.text,
    });
    return NextResponse.json({ message });
  } catch (error) {
    if (error instanceof InteractionError) {
      return jsonError(error.code, error.message, error.status);
    }
    logError({
      requestId,
      operation: "editMessage",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) {
    return unauthorized();
  }

  const { id } = await params;
  const messageId = asMessageId(id);
  if (!messageId) {
    return jsonError("NOT_FOUND", "Message not found.", 404);
  }

  try {
    const message = await deleteMessage({
      requestId,
      userId: session.user.id,
      conversationId: session.conversationId,
      messageId,
    });
    return NextResponse.json({ message });
  } catch (error) {
    if (error instanceof InteractionError) {
      return jsonError(error.code, error.message, error.status);
    }
    logError({
      requestId,
      operation: "deleteMessage",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
