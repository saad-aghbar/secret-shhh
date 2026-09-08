import { NextResponse } from "next/server";

import { musicCaught, readJson, withMusicSession } from "@/lib/music/http";
import { setPlaybackSource } from "@/lib/music/service";
import { playbackSourceSchema } from "@/lib/music/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { requestId, session, error } = await withMusicSession();
  if (!session) return error!;
  const { id } = await params;
  const json = await readJson(request);
  if (json.error) return json.error;
  const parsed = playbackSourceSchema.safeParse(json.body);
  if (!parsed.success) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "This version can’t play here." }, { status: 400 });
  }
  try {
    await setPlaybackSource({
      conversationId: session.conversationId,
      userId: session.user.id,
      trackId: id,
      youtubeVideoId: parsed.data.youtubeVideoId,
    });
    return NextResponse.json({ ok: true });
  } catch (caught) {
    return musicCaught(caught, requestId, "PATCH /api/music/tracks/[id]/playback", session.user.id);
  }
}
