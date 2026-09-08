import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const version =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
    process.env.NEXT_PUBLIC_BUILD_ID ??
    process.env.npm_package_version ??
    "dev";

  return NextResponse.json({
    ok: true,
    version,
  });
}
