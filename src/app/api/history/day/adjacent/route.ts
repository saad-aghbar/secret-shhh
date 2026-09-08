import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { getAdjacentActiveDay } from "@/lib/history/queries";
import { internalError, unauthorized, validationError } from "@/lib/http/api-error";
import { logError } from "@/lib/logger";
import { historyAdjacentQuerySchema } from "@/lib/search/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const parsed = historyAdjacentQuerySchema.safeParse({
    date: url.searchParams.get("date") ?? undefined,
    tz: url.searchParams.get("tz") ?? undefined,
    dir: url.searchParams.get("dir") ?? undefined,
  });
  if (!parsed.success) {
    return validationError("Couldn’t find another day.");
  }

  try {
    const day = await getAdjacentActiveDay({
      conversationId: session.conversationId,
      date: parsed.data.date,
      timeZone: parsed.data.tz,
      dir: parsed.data.dir,
    });
    return NextResponse.json({ day });
  } catch (error) {
    logError({
      requestId,
      operation: "historyAdjacentDay",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
