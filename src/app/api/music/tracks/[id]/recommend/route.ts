import { NextResponse } from "next/server";

import { musicCaught, readJson, withMusicSession } from "@/lib/music/http";
import { createRecommendation } from "@/lib/music/service";
import { recommendSchema } from "@/lib/music/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { requestId, session, error } = await withMusicSession();
  if (!session) return error!;
  const { id } = await params;
  const json = await readJson(request);
  if (json.error) return json.error;
  const parsed = recommendSchema.safeParse(json.body);
  if (!parsed.success) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "Couldn’t send that." }, { status: 400 });
  }
  try {
    const recommendation = await createRecommendation({
      conversationId: session.conversationId,
      userId: session.user.id,
      trackId: id,
      note: parsed.data.note,
      clientGeneratedId: parsed.data.clientGeneratedId,
    });
    return NextResponse.json({ recommendation });
  } catch (caught) {
    return musicCaught(caught, requestId, "POST /api/music/tracks/[id]/recommend", session.user.id);
  }
}
