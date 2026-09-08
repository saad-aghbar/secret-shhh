import { NextResponse } from "next/server";

import {
  getTestStoredObject,
  resolveTestDownloadToken,
  resolveTestUploadToken,
  writeTestObject,
} from "@/lib/storage/test-provider";
import { isTestStorageEnabled } from "@/lib/storage/test-storage";

export const dynamic = "force-dynamic";

/**
 * Local/e2e shim for the in-memory test storage provider.
 * Never enabled in deployed production.
 */
function testStorageEnabled() {
  return isTestStorageEnabled();
}

type Params = { params: Promise<{ token: string }> };

export async function PUT(request: Request, { params }: Params) {
  if (!testStorageEnabled()) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Not found." }, { status: 404 });
  }
  const { token } = await params;
  const entry = resolveTestUploadToken(token);
  if (!entry) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Upload expired." }, { status: 404 });
  }
  const buffer = new Uint8Array(await request.arrayBuffer());
  writeTestObject(entry.key, buffer, entry.contentType);
  return new NextResponse(null, { status: 200 });
}

export async function GET(_request: Request, { params }: Params) {
  if (!testStorageEnabled()) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Not found." }, { status: 404 });
  }
  const { token } = await params;
  const entry = resolveTestDownloadToken(token);
  if (!entry) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Link expired." }, { status: 404 });
  }
  const obj = getTestStoredObject(entry.key);
  if (!obj) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Object missing." }, { status: 404 });
  }
  const headers = new Headers({
    "Content-Type": obj.contentType,
    "Cache-Control": "private, max-age=60",
  });
  if (entry.filename) {
    headers.set(
      "Content-Disposition",
      `attachment; filename="${entry.filename.replace(/["\\\r\n]/g, "_")}"`,
    );
  }
  return new NextResponse(Buffer.from(obj.body), { status: 200, headers });
}
