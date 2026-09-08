import { NextResponse } from "next/server";

import { musicCaught, readJson, withMusicSession } from "@/lib/music/http";
import { addPlaylistTrack } from "@/lib/music/service";
import { playlistAddSchema } from "@/lib/music/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { requestId, session, error } = await withMusicSession();
  if (!session) return error!;
  const { id } = await params;
  const json = await readJson(request);
  if (json.error) return json.error;
  const parsed = playlistAddSchema.safeParse(json.body);
  if (!parsed.success) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "Couldn’t add that song." }, { status: 400 });
  }
  try {
    const playlist = await addPlaylistTrack({
      conversationId: session.conversationId,
      userId: session.user.id,
      playlistId: id,
      trackId: parsed.data.trackId,
    });
    return NextResponse.json({ playlist });
  } catch (caught) {
    return musicCaught(caught, requestId, "POST /api/music/playlists/[id]/tracks", session.user.id);
  }
}
