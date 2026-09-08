import { NextResponse } from "next/server";

import { musicCaught, withMusicSession } from "@/lib/music/http";
import { markRecommendationOpened } from "@/lib/music/service";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { requestId, session, error } = await withMusicSession();
  if (!session) return error!;
  const { id } = await params;
  try {
    await markRecommendationOpened({
      conversationId: session.conversationId,
      userId: session.user.id,
      recommendationId: id,
    });
    return NextResponse.json({ ok: true });
  } catch (caught) {
    return musicCaught(caught, requestId, "POST /api/music/recommendations/[id]/open", session.user.id);
  }
}
