import { NextResponse } from "next/server";
import { z } from "zod";

import { musicCaught, readJson, withMusicSession } from "@/lib/music/http";
import { setFavorite } from "@/lib/music/service";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { requestId, session, error } = await withMusicSession();
  if (!session) return error!;
  const { id } = await params;
  const json = await readJson(request);
  if (json.error) return json.error;
  const parsed = z.object({ favorited: z.boolean() }).safeParse(json.body);
  if (!parsed.success) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "Couldn’t update that." }, { status: 400 });
  }
  try {
    await setFavorite({
      conversationId: session.conversationId,
      userId: session.user.id,
      trackId: id,
      favorited: parsed.data.favorited,
    });
    return NextResponse.json({ ok: true });
  } catch (caught) {
    return musicCaught(caught, requestId, "PATCH /api/music/tracks/[id]/favorite", session.user.id);
  }
}
