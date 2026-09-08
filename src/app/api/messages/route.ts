import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { InteractionError } from "@/lib/chat/interactions";
import { getMessagesBefore, getRecentMessages } from "@/lib/chat/queries";
import { ChatValidationError, sendDoodleMessage, sendStickerMessage, sendTextMessage } from "@/lib/chat/send";
import { sendMusicMessage } from "@/lib/music/send";
import { jsonError, internalError, unauthorized, validationError } from "@/lib/http/api-error";
import { resolveAuthorizedSession } from "@/lib/auth/session";
import { logError } from "@/lib/logger";
import { cursorQuerySchema, sendMessageSchema } from "@/lib/validation/chat";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const parsed = cursorQuerySchema.safeParse({
    cursor: url.searchParams.get("before") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return validationError("Couldn’t load messages.");
  }

  try {
    const page = parsed.data.cursor
      ? await getMessagesBefore(
          session.conversationId,
          session.user.id,
          parsed.data.cursor,
          parsed.data.limit,
        )
      : await getRecentMessages(session.conversationId, session.user.id, parsed.data.limit);
    return NextResponse.json(page);
  } catch (error) {
    logError({
      requestId,
      operation: "getMessages",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}

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

  const parsed = sendMessageSchema.safeParse(json);
  if (!parsed.success) {
    return validationError("That message couldn’t be sent.");
  }

  // Deterministic failure for e2e / local retry verification only.
  // Header is required. Also honor it in `next dev` so Playwright can reuse
  // the existing server without E2E_FORCE_CHAT_FAIL in that process env.
  const forceFail =
    process.env.NODE_ENV !== "production" &&
    request.headers.get("x-shhh-force-fail") === "1" &&
    (process.env.E2E_FORCE_CHAT_FAIL === "1" ||
      process.env.NODE_ENV === "test" ||
      process.env.NODE_ENV === "development");
  if (forceFail) {
    return NextResponse.json(
      { code: "FORCE_FAIL", message: "Message couldn’t send. Try again." },
      { status: 503 },
    );
  }

  try {
    const message = parsed.data.stickerId
      ? await sendStickerMessage({
          requestId,
          userId: session.user.id,
          conversationId: session.conversationId,
          stickerId: parsed.data.stickerId,
          clientGeneratedId: parsed.data.clientGeneratedId,
          replyToMessageId: parsed.data.replyToMessageId,
        })
      : parsed.data.doodle
        ? await sendDoodleMessage({
            requestId,
            userId: session.user.id,
            conversationId: session.conversationId,
            document: parsed.data.doodle as import("@/lib/doodles/document").DoodleDocument,
            clientGeneratedId: parsed.data.clientGeneratedId,
            replyToMessageId: parsed.data.replyToMessageId,
          })
        : parsed.data.music
          ? await sendMusicMessage({
              requestId,
              userId: session.user.id,
              conversationId: session.conversationId,
              trackId: parsed.data.music.trackId,
              clientGeneratedId: parsed.data.clientGeneratedId,
              text: parsed.data.text,
              replyToMessageId: parsed.data.replyToMessageId,
              clipStartMs: parsed.data.music.clipStartMs,
              clipEndMs: parsed.data.music.clipEndMs,
              youtubeVideoId: parsed.data.music.youtubeVideoId,
            })
        : await sendTextMessage({
            requestId,
            userId: session.user.id,
            conversationId: session.conversationId,
            text: parsed.data.text!,
            clientGeneratedId: parsed.data.clientGeneratedId,
            replyToMessageId: parsed.data.replyToMessageId,
          });
    return NextResponse.json({ message });
  } catch (error) {
    if (error instanceof ChatValidationError) {
      return validationError(error.message);
    }
    if (error instanceof InteractionError) {
      return jsonError(error.code, error.message, error.status);
    }
    logError({
      requestId,
      operation: "sendMessage",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return jsonError("INTERNAL", "Message couldn’t send. Try again.", 500);
  }
}
