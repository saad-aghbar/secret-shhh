import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { unauthorized, validationError, internalError } from "@/lib/http/api-error";
import { MediaValidationError, finalizePhotoMessage } from "@/lib/media/service";
import { finalizePhotoMessageSchema } from "@/lib/media/validation";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError("Invalid request.");
  }

  const parsed = finalizePhotoMessageSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues[0]?.message ?? "Invalid photo message.");
  }

  try {
    const message = await finalizePhotoMessage({
      requestId,
      userId: session.user.id,
      conversationId: session.conversationId,
      clientGeneratedId: parsed.data.clientGeneratedId,
      caption: parsed.data.caption,
      replyToMessageId: parsed.data.replyToMessageId,
      assets: parsed.data.assets,
    });
    return NextResponse.json({ message });
  } catch (error) {
    if (error instanceof MediaValidationError) {
      return validationError(error.message);
    }
    logError({
      requestId,
      operation: "POST /api/media/messages",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
