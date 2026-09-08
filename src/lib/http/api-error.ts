import { NextResponse } from "next/server";

import type { ApiErrorBody, ApiErrorCode } from "@/types/api";

export function jsonError(code: ApiErrorCode, message: string, status: number) {
  const body: ApiErrorBody = { code, message };
  return NextResponse.json(body, { status });
}

export function unauthorized() {
  return jsonError("UNAUTHORIZED", "Please sign in.", 401);
}

export function forbidden() {
  return jsonError("FORBIDDEN", "You can’t do that.", 403);
}

export function validationError(message = "That message couldn’t be sent.") {
  return jsonError("VALIDATION_ERROR", message, 400);
}

export function internalError() {
  return jsonError("INTERNAL", "Something went wrong. Try again.", 500);
}

export function rateLimited(message = "Try again in a moment.") {
  return jsonError("RATE_LIMITED", message, 429);
}
