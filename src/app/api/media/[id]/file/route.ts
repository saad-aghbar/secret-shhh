import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { unauthorized, validationError, internalError, jsonError } from "@/lib/http/api-error";
import { MediaValidationError, getAuthorizedMediaBytes } from "@/lib/media/service";
import { mediaUrlVariantSchema } from "@/lib/media/validation";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const querySchema = z.object({
  variant: mediaUrlVariantSchema.default("original"),
});

/**
 * Authenticated same-origin media bytes for Save photo / share.
 * Avoids browser CORS against private R2 signed URLs.
 */
export async function GET(request: Request, { params }: Params) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  const { id } = await params;
  if (!id) return validationError("Missing media id.");

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    variant: url.searchParams.get("variant") ?? "original",
  });
  if (!parsed.success) return validationError("Invalid media request.");

  try {
    const result = await getAuthorizedMediaBytes({
      requestId,
      userId: session.user.id,
      conversationId: session.conversationId,
      mediaId: id,
      variant: parsed.data.variant,
    });
    const headers = new Headers({
      "Content-Type": result.contentType,
      "Cache-Control": "private, max-age=60",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    });
    return new NextResponse(Buffer.from(result.bytes), { status: 200, headers });
  } catch (error) {
    if (error instanceof MediaValidationError) {
      if (error.message.includes("not found")) {
        return jsonError("NOT_FOUND", error.message, 404);
      }
      return validationError(error.message);
    }
    logError({
      requestId,
      operation: "GET /api/media/[id]/file",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
