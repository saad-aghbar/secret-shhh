import { NextResponse } from "next/server";

import { musicCaught, withMusicSession } from "@/lib/music/http";
import { removePlaylistTrack } from "@/lib/music/service";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; trackId: string }> },
) {
  const { requestId, session, error } = await withMusicSession();
  if (!session) return error!;
  const { id, trackId } = await params;
  try {
    await removePlaylistTrack({
      conversationId: session.conversationId,
      userId: session.user.id,
      playlistId: id,
      trackId,
    });
    return NextResponse.json({ ok: true });
  } catch (caught) {
    return musicCaught(caught, requestId, "DELETE /api/music/playlists/[id]/tracks/[trackId]", session.user.id);
  }
}
