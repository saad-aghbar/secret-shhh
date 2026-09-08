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
  setFavorite,
} from "@/lib/stickers/service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function toggle(favorite: boolean, { params }: Params) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return validationError("Couldn't find that.");
  }

  try {
    const sticker = await setFavorite({
      requestId,
      userId: session.user.id,
      conversationId: session.conversationId,
      stickerId: id,
      favorite,
    });
    return NextResponse.json({ sticker });
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
      operation: "sticker favorite",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}

export async function PUT(_request: Request, context: Params) {
  return toggle(true, context);
}

export async function DELETE(_request: Request, context: Params) {
  return toggle(false, context);
}
