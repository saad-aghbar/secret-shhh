import { NextResponse } from "next/server";

import { musicCaught, readJson, withMusicSession } from "@/lib/music/http";
import { recordRecentlyPlayed } from "@/lib/music/service";
import { recentlyPlayedSchema } from "@/lib/music/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { requestId, session, error } = await withMusicSession();
  if (!session) return error!;
  const json = await readJson(request);
  if (json.error) return json.error;
  const parsed = recentlyPlayedSchema.safeParse(json.body);
  if (!parsed.success) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "Couldn’t save that." }, { status: 400 });
  }
  try {
    await recordRecentlyPlayed({
      conversationId: session.conversationId,
      userId: session.user.id,
      trackId: parsed.data.trackId,
    });
    return NextResponse.json({ ok: true });
  } catch (caught) {
    return musicCaught(caught, requestId, "POST /api/music/played", session.user.id);
  }
}
