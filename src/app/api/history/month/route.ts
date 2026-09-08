import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { getMonthActivity } from "@/lib/history/queries";
import { internalError, unauthorized, validationError } from "@/lib/http/api-error";
import { logError } from "@/lib/logger";
import { historyMonthQuerySchema } from "@/lib/search/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const parsed = historyMonthQuerySchema.safeParse({
    year: url.searchParams.get("year") ?? undefined,
    month: url.searchParams.get("month") ?? undefined,
    tz: url.searchParams.get("tz") ?? undefined,
  });
  if (!parsed.success) {
    return validationError("Couldn’t load that month.");
  }

  try {
    const days = await getMonthActivity({
      conversationId: session.conversationId,
      year: parsed.data.year,
      month: parsed.data.month,
      timeZone: parsed.data.tz,
    });
    return NextResponse.json({
      year: parsed.data.year,
      month: parsed.data.month,
      days,
    });
  } catch (error) {
    logError({
      requestId,
      operation: "historyMonth",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
