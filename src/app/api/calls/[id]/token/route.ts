import { NextResponse } from "next/server";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { mapCallError } from "@/lib/calls/errors";
import { getCallForUser } from "@/lib/calls/service";
import { mintCallToken } from "@/lib/livekit/token";
import { internalError, rateLimited, unauthorized, validationError } from "@/lib/http/api-error";
import { RouteRateLimitError } from "@/lib/http/route-rate-limit-error";
import { assertRouteRateLimit } from "@/lib/http/route-rate-limit";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return validationError("Couldn't find that call.");
  try {
    await assertRouteRateLimit({
      key: `call-token:${session.user.id}`,
      max: 240,
      windowMs: 10 * 60 * 1000,
      message: "Wait a moment before joining again.",
    });
    const call = await getCallForUser({ userId: session.user.id, callId: id });
    const minted = await mintCallToken({
      call,
      userId: session.user.id,
      displayName: session.user.displayName,
    });
    return NextResponse.json({ url: minted.url, token: minted.token });
  } catch (error) {
    if (error instanceof RouteRateLimitError) {
      return rateLimited(error.message);
    }
    return mapCallError(error) ?? internalError();
  }
}
