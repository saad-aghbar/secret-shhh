import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { unauthorized, validationError, internalError } from "@/lib/http/api-error";
import { MediaValidationError, finalizeVoiceMessage } from "@/lib/media/service";
import { finalizeVoiceMessageSchema } from "@/lib/media/validation";
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

  const parsed = finalizeVoiceMessageSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues[0]?.message ?? "Invalid voice message.");
  }

  try {
    const message = await finalizeVoiceMessage({
      requestId,
      userId: session.user.id,
      conversationId: session.conversationId,
      clientGeneratedId: parsed.data.clientGeneratedId,
      uploadId: parsed.data.uploadId,
      durationMs: parsed.data.durationMs,
      waveform: parsed.data.waveform,
      replyToMessageId: parsed.data.replyToMessageId,
    });
    return NextResponse.json({ message });
  } catch (error) {
    if (error instanceof MediaValidationError) {
      return validationError(error.message);
    }
    logError({
      requestId,
      operation: "POST /api/media/voice/messages",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
