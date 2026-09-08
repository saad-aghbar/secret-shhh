import { NextResponse } from "next/server";

import { musicCaught, withMusicSession } from "@/lib/music/http";
import { getOfflineSnapshot } from "@/lib/music/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const { requestId, session, error } = await withMusicSession();
  if (!session) return error!;
  try {
    const snapshot = await getOfflineSnapshot(session.conversationId, session.user.id);
    return NextResponse.json(snapshot);
  } catch (caught) {
    return musicCaught(caught, requestId, "GET /api/music/snapshot", session.user.id);
  }
}
