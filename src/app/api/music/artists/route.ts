import { NextResponse } from "next/server";

import { musicCaught, withMusicSession } from "@/lib/music/http";
import { groupArtists } from "@/lib/music/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const { requestId, session, error } = await withMusicSession();
  if (!session) return error!;
  try {
    const artists = await groupArtists(session.conversationId, session.user.id);
    return NextResponse.json({ artists });
  } catch (caught) {
    return musicCaught(caught, requestId, "GET /api/music/artists", session.user.id);
  }
}
