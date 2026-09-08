import { NextResponse } from "next/server";

import { musicCaught, withMusicSession } from "@/lib/music/http";
import { getMusicHome } from "@/lib/music/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const { requestId, session, error } = await withMusicSession();
  if (!session) return error!;
  try {
    const home = await getMusicHome(session.conversationId, session.user.id);
    return NextResponse.json({ home, viewerId: session.user.id, partner: session.partner });
  } catch (caught) {
    return musicCaught(caught, requestId, "GET /api/music/home", session.user.id);
  }
}
