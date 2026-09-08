import { NextResponse } from "next/server";

import { musicCaught, readJson, withMusicSession } from "@/lib/music/http";
import { reorderPlaylist } from "@/lib/music/service";
import { playlistOrderSchema } from "@/lib/music/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { requestId, session, error } = await withMusicSession();
  if (!session) return error!;
  const { id } = await params;
  const json = await readJson(request);
  if (json.error) return json.error;
  const parsed = playlistOrderSchema.safeParse(json.body);
  if (!parsed.success) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "That order is out of date. Try again." }, { status: 400 });
  }
  try {
    const playlist = await reorderPlaylist({
      conversationId: session.conversationId,
      userId: session.user.id,
      playlistId: id,
      trackIds: parsed.data.trackIds,
    });
    return NextResponse.json({ playlist });
  } catch (caught) {
    return musicCaught(caught, requestId, "PATCH /api/music/playlists/[id]/order", session.user.id);
  }
}
