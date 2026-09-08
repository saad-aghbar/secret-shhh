import { NextResponse } from "next/server";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { unauthorized } from "@/lib/http/api-error";
import { setLockCookie } from "@/lib/privacy/lock-cookie";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await resolveAuthorizedSession();
  if (!session) return unauthorized();
  await setLockCookie();
  return NextResponse.json({ ok: true, locked: true });
}
