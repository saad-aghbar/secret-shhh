import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { getOutgoingReceiptStates } from "@/lib/chat/receipts";
import { internalError, unauthorized, validationError } from "@/lib/http/api-error";
import { logError } from "@/lib/logger";
import { queryReceiptsSchema } from "@/lib/validation/chat";

export const dynamic = "force-dynamic";

/** Refresh partner receipt state for the viewer's outgoing messages. */
export async function POST(request: Request) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) {
    return unauthorized();
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return validationError();
  }

  const parsed = queryReceiptsSchema.safeParse(json);
  if (!parsed.success) {
    return validationError();
  }

  try {
    const receipts = await getOutgoingReceiptStates({
      userId: session.user.id,
      conversationId: session.conversationId,
      messageIds: parsed.data.messageIds,
    });
    return NextResponse.json({ receipts });
  } catch (error) {
    logError({
      requestId,
      operation: "queryReceipts",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
