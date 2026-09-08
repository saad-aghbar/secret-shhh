import { NextResponse } from "next/server";

import { musicCaught, readJson, withMusicSession } from "@/lib/music/http";
import { reactToRecommendation } from "@/lib/music/service";
import { recommendationReactSchema } from "@/lib/music/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { requestId, session, error } = await withMusicSession();
  if (!session) return error!;
  const { id } = await params;
  const json = await readJson(request);
  if (json.error) return json.error;
  const parsed = recommendationReactSchema.safeParse(json.body);
  if (!parsed.success) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "Couldn’t save that." }, { status: 400 });
  }
  try {
    await reactToRecommendation({
      conversationId: session.conversationId,
      userId: session.user.id,
      recommendationId: id,
      reaction: parsed.data.reaction,
    });
    return NextResponse.json({ ok: true });
  } catch (caught) {
    return musicCaught(caught, requestId, "POST /api/music/recommendations/[id]/react", session.user.id);
  }
}
