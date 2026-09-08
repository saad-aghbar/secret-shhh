import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { getMessagesOnDay } from "@/lib/history/queries";
import { internalError, unauthorized, validationError } from "@/lib/http/api-error";
import { logError } from "@/lib/logger";
import { historyDayQuerySchema } from "@/lib/search/validation";

export const dynamic = "force-dynamic";

/** List messages for a local calendar day (History preview — not auto-jump). */
export async function GET(request: Request) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const parsed = historyDayQuerySchema.safeParse({
    date: url.searchParams.get("date") ?? undefined,
    tz: url.searchParams.get("tz") ?? undefined,
  });
  if (!parsed.success) {
    return validationError("Couldn’t load that day.");
  }

  try {
    const messages = await getMessagesOnDay({
      conversationId: session.conversationId,
      viewerId: session.user.id,
      date: parsed.data.date,
      timeZone: parsed.data.tz,
    });
    return NextResponse.json({ date: parsed.data.date, messages });
  } catch (error) {
    logError({
      requestId,
      operation: "historyDayMessages",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
