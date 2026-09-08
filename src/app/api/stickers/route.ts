import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import {
  forbidden,
  internalError,
  jsonError,
  unauthorized,
  validationError,
} from "@/lib/http/api-error";
import { logError } from "@/lib/logger";
import {
  StickerForbiddenError,
  StickerNotFoundError,
  StickerValidationError,
  createSticker,
  listStickers,
} from "@/lib/stickers/service";
import { createStickerMetaSchema } from "@/lib/stickers/validation";

export const dynamic = "force-dynamic";

function mapStickerError(error: unknown) {
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

export async function GET() {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  try {
    const library = await listStickers({
      userId: session.user.id,
      conversationId: session.conversationId,
    });
    return NextResponse.json(library);
  } catch (error) {
    const mapped = mapStickerError(error);
    if (mapped) return mapped;
    logError({
      requestId,
      operation: "GET /api/stickers",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return validationError("That sticker couldn't be saved.");
  }

  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return validationError("Choose an image first.");
  }

  const parsed = createStickerMetaSchema.safeParse({
    id: form.get("id"),
    name: form.get("name") || undefined,
    animated: form.get("animated") ?? undefined,
    width: form.get("width"),
    height: form.get("height"),
    checksum: form.get("checksum") || undefined,
  });
  if (!parsed.success) {
    return validationError("That sticker couldn't be saved.");
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sticker = await createSticker({
      requestId,
      userId: session.user.id,
      conversationId: session.conversationId,
      bytes,
      declaredMime: file.type || null,
      meta: parsed.data,
    });
    return NextResponse.json({ sticker });
  } catch (error) {
    const mapped = mapStickerError(error);
    if (mapped) return mapped;
    logError({
      requestId,
      operation: "POST /api/stickers",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
