import { NextResponse } from "next/server";

import { musicCaught, readJson, withMusicSession } from "@/lib/music/http";
import { deletePlaylist, getPlaylistDetail, patchPlaylist } from "@/lib/music/service";
import { playlistPatchSchema } from "@/lib/music/validation";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { requestId, session, error } = await withMusicSession();
  if (!session) return error!;
  const { id } = await params;
  try {
    const playlist = await getPlaylistDetail(session.conversationId, session.user.id, id);
    return NextResponse.json({ playlist });
  } catch (caught) {
    return musicCaught(caught, requestId, "GET /api/music/playlists/[id]", session.user.id);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { requestId, session, error } = await withMusicSession();
  if (!session) return error!;
  const { id } = await params;
  const json = await readJson(request);
  if (json.error) return json.error;
  const parsed = playlistPatchSchema.safeParse(json.body);
  if (!parsed.success) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "Couldn’t update that playlist." }, { status: 400 });
  }
  try {
    const playlist = await patchPlaylist({
      conversationId: session.conversationId,
      userId: session.user.id,
      playlistId: id,
      ...parsed.data,
    });
    return NextResponse.json({ playlist });
  } catch (caught) {
    return musicCaught(caught, requestId, "PATCH /api/music/playlists/[id]", session.user.id);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { requestId, session, error } = await withMusicSession();
  if (!session) return error!;
  const { id } = await params;
  try {
    await deletePlaylist({ conversationId: session.conversationId, userId: session.user.id, playlistId: id });
    return NextResponse.json({ ok: true });
  } catch (caught) {
    return musicCaught(caught, requestId, "DELETE /api/music/playlists/[id]", session.user.id);
  }
}
