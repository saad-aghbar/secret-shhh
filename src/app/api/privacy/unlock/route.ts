import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { unauthorized, validationError } from "@/lib/http/api-error";
import { clearLockCookies } from "@/lib/privacy/lock-cookie";
import { verifyUnlockPassword } from "@/lib/privacy/unlock";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  password: z.string().min(1).max(1024),
});

export async function POST(request: Request) {
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError("That password isn’t right.");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return validationError("That password isn’t right.");
  }

  const result = await verifyUnlockPassword({
    session,
    password: parsed.data.password,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 401 });
  }

  await clearLockCookies();
  return NextResponse.json({ ok: true, locked: false });
}
