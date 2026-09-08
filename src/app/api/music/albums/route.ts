import { NextResponse } from "next/server";

import { musicCaught, withMusicSession } from "@/lib/music/http";
import { groupAlbums } from "@/lib/music/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const { requestId, session, error } = await withMusicSession();
  if (!session) return error!;
  try {
    const albums = await groupAlbums(session.conversationId, session.user.id);
    return NextResponse.json({ albums });
  } catch (caught) {
    return musicCaught(caught, requestId, "GET /api/music/albums", session.user.id);
  }
}
