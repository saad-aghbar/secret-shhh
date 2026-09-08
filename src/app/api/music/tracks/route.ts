import { NextResponse } from "next/server";

import { musicCaught, readJson, withMusicSession } from "@/lib/music/http";
import { saveResolvedTrack } from "@/lib/music/service";
import { saveTrackSchema } from "@/lib/music/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { requestId, session, error } = await withMusicSession();
  if (!session) return error!;
  const json = await readJson(request);
  if (json.error) return json.error;
  const parsed = saveTrackSchema.safeParse(json.body);
  if (!parsed.success) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "Couldn’t save that song." }, { status: 400 });
  }
  try {
    const track = await saveResolvedTrack({
      conversationId: session.conversationId,
      userId: session.user.id,
      ...parsed.data,
    });
    return NextResponse.json({ track });
  } catch (caught) {
    return musicCaught(caught, requestId, "POST /api/music/tracks", session.user.id);
  }
}
