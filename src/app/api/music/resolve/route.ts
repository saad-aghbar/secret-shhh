import { NextResponse } from "next/server";

import { musicCaught, readJson, withMusicSession } from "@/lib/music/http";
import { resolveMusicUrl } from "@/lib/music/providers/resolve";
import { assertMusicProviderAllowed } from "@/lib/music/rate-limit";
import { musicUrlSchema } from "@/lib/music/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { requestId, session, error } = await withMusicSession();
  if (!session) return error!;
  const json = await readJson(request);
  if (json.error) return json.error;
  const parsed = musicUrlSchema.safeParse(json.body);
  if (!parsed.success) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "Try another link." }, { status: 400 });
  }
  try {
    await assertMusicProviderAllowed(session.user.id, "resolve");
    const preview = await resolveMusicUrl({
      conversationId: session.conversationId,
      url: parsed.data.url,
      userId: session.user.id,
    });
    return NextResponse.json({ preview });
  } catch (caught) {
    return musicCaught(caught, requestId, "POST /api/music/resolve", session.user.id);
  }
}
