import { NextResponse } from "next/server";
import { z } from "zod";

import { musicCaught, readJson, withMusicSession } from "@/lib/music/http";
import { listSongOfMomentHistory, setSongOfMoment } from "@/lib/music/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const { requestId, session, error } = await withMusicSession();
  if (!session) return error!;
  try {
    const history = await listSongOfMomentHistory(session.conversationId, session.user.id);
    return NextResponse.json({ history });
  } catch (caught) {
    return musicCaught(caught, requestId, "GET /api/music/song-of-moment", session.user.id);
  }
}

export async function POST(request: Request) {
  const { requestId, session, error } = await withMusicSession();
  if (!session) return error!;
  const json = await readJson(request);
  if (json.error) return json.error;
  const parsed = z.object({ trackId: z.uuid() }).safeParse(json.body);
  if (!parsed.success) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "Couldn’t set that song." }, { status: 400 });
  }
  try {
    const song = await setSongOfMoment({
      conversationId: session.conversationId,
      userId: session.user.id,
      trackId: parsed.data.trackId,
    });
    return NextResponse.json({ song });
  } catch (caught) {
    return musicCaught(caught, requestId, "POST /api/music/song-of-moment", session.user.id);
  }
}
