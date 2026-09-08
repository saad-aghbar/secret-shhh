import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { unauthorized, validationError, internalError, jsonError } from "@/lib/http/api-error";
import { MediaValidationError, createMediaReadUrl } from "@/lib/media/service";
import { mediaUrlVariantSchema } from "@/lib/media/validation";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const querySchema = z.object({
  variant: mediaUrlVariantSchema,
  download: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .transform((v) => v === "1" || v === "true"),
});

export async function GET(request: Request, { params }: Params) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  const { id } = await params;
  if (!id) return validationError("Missing media id.");

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    variant: url.searchParams.get("variant"),
    download: url.searchParams.get("download") ?? undefined,
  });
  if (!parsed.success) {
    return validationError("Invalid media request.");
  }

  try {
    const result = await createMediaReadUrl({
      requestId,
      userId: session.user.id,
      conversationId: session.conversationId,
      mediaId: id,
      variant: parsed.data.variant,
      download: parsed.data.download,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof MediaValidationError) {
      if (error.message.includes("not found")) {
        return jsonError("NOT_FOUND", error.message, 404);
      }
      return validationError(error.message);
    }
    logError({
      requestId,
      operation: "GET /api/media/[id]/url",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
