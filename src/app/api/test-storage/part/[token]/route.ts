import { NextResponse } from "next/server";

import {
  consumeTestPartFailure,
  resolveTestPartToken,
  writeTestPart,
} from "@/lib/storage/test-provider";
import { isTestStorageEnabled } from "@/lib/storage/test-storage";

export const dynamic = "force-dynamic";

function testStorageEnabled() {
  return isTestStorageEnabled();
}

type Params = { params: Promise<{ token: string }> };

export async function PUT(request: Request, { params }: Params) {
  if (!testStorageEnabled()) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Not found." }, { status: 404 });
  }
  const { token } = await params;
  const entry = resolveTestPartToken(token);
  if (!entry) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Upload expired." }, { status: 404 });
  }
  if (consumeTestPartFailure()) {
    return NextResponse.json({ code: "INTERNAL", message: "Part failed." }, { status: 500 });
  }
  const buffer = new Uint8Array(await request.arrayBuffer());
  try {
    const etag = writeTestPart(entry.uploadId, entry.partNumber, buffer);
    return new NextResponse(null, {
      status: 200,
      headers: {
        ETag: etag,
        "Access-Control-Expose-Headers": "ETag",
      },
    });
  } catch {
    return NextResponse.json({ code: "NOT_FOUND", message: "Upload expired." }, { status: 404 });
  }
}
