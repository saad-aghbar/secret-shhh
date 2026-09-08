import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { mapCallError } from "@/lib/calls/errors";
import { getActiveCall, startCall } from "@/lib/calls/service";
import { internalError, unauthorized, validationError } from "@/lib/http/api-error";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

const startSchema = z.object({
  type: z.enum(["audio", "video"]),
});

export async function GET() {
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();
  try {
    const call = await getActiveCall({
      userId: session.user.id,
      conversationId: session.conversationId,
    });
    return NextResponse.json({
      call,
      partnerName: session.partner?.displayName ?? "your person",
      conversationId: session.conversationId,
    });
  } catch (error) {
    const mapped = mapCallError(error);
    if (mapped) return mapped;
    return internalError();
  }
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return validationError("Couldn't start the call.");
  }
  const parsed = startSchema.safeParse(json);
  if (!parsed.success) return validationError("Couldn't start the call.");
  try {
    const call = await startCall({
      requestId,
      userId: session.user.id,
      conversationId: session.conversationId,
      type: parsed.data.type,
    });
    return NextResponse.json(call);
  } catch (error) {
    const mapped = mapCallError(error);
    if (mapped) return mapped;
    logError({
      requestId,
      operation: "POST /api/calls",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
