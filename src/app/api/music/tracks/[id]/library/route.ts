import { NextResponse } from "next/server";

import { musicCaught, readJson, withMusicSession } from "@/lib/music/http";
import { setLibraryEntry } from "@/lib/music/service";
import { libraryPatchSchema } from "@/lib/music/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { requestId, session, error } = await withMusicSession();
  if (!session) return error!;
  const { id } = await params;
  const json = await readJson(request);
  if (json.error) return json.error;
  const parsed = libraryPatchSchema.safeParse(json.body);
  if (!parsed.success) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "Couldn’t update the library." }, { status: 400 });
  }
  try {
    await setLibraryEntry({
      conversationId: session.conversationId,
      userId: session.user.id,
      trackId: id,
      scope: parsed.data.scope,
      saved: parsed.data.saved,
    });
    return NextResponse.json({ ok: true });
  } catch (caught) {
    return musicCaught(caught, requestId, "PATCH /api/music/tracks/[id]/library", session.user.id);
  }
}
