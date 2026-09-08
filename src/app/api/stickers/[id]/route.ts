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
  archiveSticker,
  renameSticker,
} from "@/lib/stickers/service";
import { renameStickerSchema } from "@/lib/stickers/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function mapError(error: unknown) {
  if (error instanceof StickerValidationError) {
    return validationError(error.message);
  }
  if (error instanceof StickerNotFoundError) {
    return jsonError("NOT_FOUND", error.message, 404);
  }
  if (error instanceof StickerForbiddenError) {
    return forbidden();
  }
  return null;
}

export async function PATCH(request: Request, { params }: Params) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return validationError("Couldn't find that.");
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return validationError("That name couldn't be saved.");
  }
  const parsed = renameStickerSchema.safeParse(json);
  if (!parsed.success) {
    return validationError("That name is a bit long.");
  }

  try {
    const sticker = await renameSticker({
      requestId,
      userId: session.user.id,
      conversationId: session.conversationId,
      stickerId: id,
      name: parsed.data.name,
    });
    return NextResponse.json({ sticker });
  } catch (error) {
    const mapped = mapError(error);
    if (mapped) return mapped;
    logError({
      requestId,
      operation: "PATCH /api/stickers/[id]",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return validationError("Couldn't find that.");
  }

  try {
    const result = await archiveSticker({
      requestId,
      userId: session.user.id,
      conversationId: session.conversationId,
      stickerId: id,
    });
    return NextResponse.json(result);
  } catch (error) {
    const mapped = mapError(error);
    if (mapped) return mapped;
    logError({
      requestId,
      operation: "DELETE /api/stickers/[id]",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
