import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { jsonError, internalError, unauthorized, validationError } from "@/lib/http/api-error";
import { logError } from "@/lib/logger";
import { MusicError } from "@/lib/music/errors";

export async function withMusicSession() {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) {
    return { requestId, session: null, error: unauthorized() as NextResponse };
  }
  return { requestId, session, error: null };
}

export function musicCaught(error: unknown, requestId: string, operation: string, userId?: string) {
  if (error instanceof MusicError) {
    return jsonError(error.code === "RATE_LIMITED" ? "RATE_LIMITED" : error.code === "NOT_FOUND" ? "NOT_FOUND" : error.code === "FORBIDDEN" ? "FORBIDDEN" : "VALIDATION_ERROR", error.message, error.status);
  }
  logError({
    requestId,
    operation,
    userId,
    errorClass: error instanceof Error ? error.name : "unknown",
  });
  return internalError();
}

export async function readJson(request: Request) {
  try {
    return { body: await request.json(), error: null };
  } catch {
    return { body: null, error: validationError("That didn’t work. Try again.") };
  }
}
