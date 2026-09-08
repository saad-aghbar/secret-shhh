import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { mapCallError } from "@/lib/calls/errors";
import {
  failCall,
  getCallForUser,
  markCallConnected,
  markCallReconnecting,
} from "@/lib/calls/service";
import { internalError, unauthorized, validationError } from "@/lib/http/api-error";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  action: z.enum(["connected", "reconnecting", "failed"]),
});

function asId(id: string) {
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

export async function GET(_request: Request, { params }: Params) {
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();
  const { id } = await params;
  const callId = asId(id);
  if (!callId) return validationError("Couldn't find that call.");
  try {
    return NextResponse.json(await getCallForUser({ userId: session.user.id, callId }));
  } catch (error) {
    return mapCallError(error) ?? internalError();
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();
  const { id } = await params;
  const callId = asId(id);
  if (!callId) return validationError("Couldn't find that call.");
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return validationError("Couldn't update the call.");
  }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return validationError("Couldn't update the call.");
  try {
    if (parsed.data.action === "connected") {
      return NextResponse.json(await markCallConnected({ userId: session.user.id, callId }));
    }
    if (parsed.data.action === "reconnecting") {
      return NextResponse.json(await markCallReconnecting({ userId: session.user.id, callId }));
    }
    return NextResponse.json(await failCall({ userId: session.user.id, callId }));
  } catch (error) {
    void requestId;
    return mapCallError(error) ?? internalError();
  }
}
