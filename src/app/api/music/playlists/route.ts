import { NextResponse } from "next/server";

import { musicCaught, readJson, withMusicSession } from "@/lib/music/http";
import { createPlaylist, listPlaylists } from "@/lib/music/service";
import { playlistCreateSchema } from "@/lib/music/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const { requestId, session, error } = await withMusicSession();
  if (!session) return error!;
  try {
    const playlists = await listPlaylists(session.conversationId, session.user.id);
    return NextResponse.json({ playlists });
  } catch (caught) {
    return musicCaught(caught, requestId, "GET /api/music/playlists", session.user.id);
  }
}

export async function POST(request: Request) {
  const { requestId, session, error } = await withMusicSession();
  if (!session) return error!;
  const json = await readJson(request);
  if (json.error) return json.error;
  const parsed = playlistCreateSchema.safeParse(json.body);
  if (!parsed.success) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "Couldn’t make that playlist." }, { status: 400 });
  }
  try {
    const playlist = await createPlaylist({
      conversationId: session.conversationId,
      userId: session.user.id,
      title: parsed.data.title,
      note: parsed.data.note,
      collaborative: parsed.data.collaborative,
    });
    return NextResponse.json({ playlist });
  } catch (caught) {
    return musicCaught(caught, requestId, "POST /api/music/playlists", session.user.id);
  }
}
