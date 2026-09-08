import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { forbidden, internalError, jsonError, unauthorized, validationError } from "@/lib/http/api-error";
import { logError } from "@/lib/logger";
import {
  StickerForbiddenError,
  StickerNotFoundError,
  StickerValidationError,
  createStickerReadUrl,
} from "@/lib/stickers/service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return validationError("Couldn't find that.");
  }

  try {
    const result = await createStickerReadUrl({
      requestId,
      userId: session.user.id,
      conversationId: session.conversationId,
      stickerId: id,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof StickerValidationError) {
      return validationError(error.message);
    }
    if (error instanceof StickerNotFoundError) {
      return jsonError("NOT_FOUND", error.message, 404);
    }
    if (error instanceof StickerForbiddenError) {
      return forbidden();
    }
    logError({
      requestId,
      operation: "GET /api/stickers/[id]/url",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
