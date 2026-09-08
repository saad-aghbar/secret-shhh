import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { internalError, unauthorized, validationError } from "@/lib/http/api-error";
import { mapThemeError } from "@/lib/theme/errors";
import {
  getThemeForUser,
  resetThemeConfig,
  saveThemeConfig,
  saveThemeMode,
} from "@/lib/theme/service";
import { patchThemeModeSchema, saveThemeSchema } from "@/lib/theme/validation";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();
  try {
    return NextResponse.json(await getThemeForUser(session.user.id));
  } catch (error) {
    const mapped = mapThemeError(error);
    if (mapped) return mapped;
    logError({
      requestId,
      operation: "GET /api/theme",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}

export async function PUT(request: Request) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError("Couldn't save this theme.");
  }

  const parsed = saveThemeSchema.safeParse(body);
  if (!parsed.success) {
    return validationError("Couldn't save this theme.");
  }

  try {
    const payload = await saveThemeConfig({
      requestId,
      userId: session.user.id,
      target: parsed.data.target,
      input: parsed.data.config,
    });
    return NextResponse.json(payload);
  } catch (error) {
    const mapped = mapThemeError(error);
    if (mapped) return mapped;
    logError({
      requestId,
      operation: "PUT /api/theme",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}

export async function DELETE(request: Request) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  const target = new URL(request.url).searchParams.get("target");
  if (target !== "light" && target !== "dark") {
    return validationError("Couldn't save this theme.");
  }

  try {
    const payload = await resetThemeConfig({
      requestId,
      userId: session.user.id,
      target,
    });
    return NextResponse.json(payload);
  } catch (error) {
    const mapped = mapThemeError(error);
    if (mapped) return mapped;
    logError({
      requestId,
      operation: "DELETE /api/theme",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}

export async function PATCH(request: Request) {
  const requestId = randomUUID();
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError("Couldn't save this theme.");
  }

  const parsed = patchThemeModeSchema.safeParse(body);
  if (!parsed.success) {
    return validationError("Couldn't save this theme.");
  }

  try {
    const payload = await saveThemeMode({
      requestId,
      userId: session.user.id,
      mode: parsed.data.mode,
    });
    return NextResponse.json(payload);
  } catch (error) {
    const mapped = mapThemeError(error);
    if (mapped) return mapped;
    logError({
      requestId,
      operation: "PATCH /api/theme",
      userId: session.user.id,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return internalError();
  }
}
