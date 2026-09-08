import { NextResponse } from "next/server";

import { musicCaught, withMusicSession } from "@/lib/music/http";
import { getTrackDetail } from "@/lib/music/service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { requestId, session, error } = await withMusicSession();
  if (!session) return error!;
  const { id } = await params;
  try {
    const detail = await getTrackDetail(session.conversationId, session.user.id, id);
    return NextResponse.json(detail);
  } catch (caught) {
    return musicCaught(caught, requestId, "GET /api/music/tracks/[id]", session.user.id);
  }
}
