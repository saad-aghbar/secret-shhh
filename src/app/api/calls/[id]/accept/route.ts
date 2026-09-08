import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { mapCallError } from "@/lib/calls/errors";
import { acceptCall } from "@/lib/calls/service";
import { internalError, unauthorized, validationError } from "@/lib/http/api-error";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return validationError("Couldn't find that call.");
  try {
    return NextResponse.json(
      await acceptCall({ requestId, userId: session.user.id, callId: id }),
    );
  } catch (error) {
    return mapCallError(error) ?? internalError();
  }
}
