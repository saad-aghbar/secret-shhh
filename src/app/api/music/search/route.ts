import { NextResponse } from "next/server";

import { musicCaught, withMusicSession } from "@/lib/music/http";
import { assertMusicProviderAllowed } from "@/lib/music/rate-limit";
import { searchMusicLibrary } from "@/lib/music/service";
import { musicSearchQuerySchema } from "@/lib/music/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { requestId, session, error } = await withMusicSession();
  if (!session) return error!;
  const url = new URL(request.url);
  const parsed = musicSearchQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    discover: url.searchParams.get("discover") ?? "0",
  });
  if (!parsed.success) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "Couldn’t search." }, { status: 400 });
  }
  try {
    if (parsed.data.discover === "1") {
      await assertMusicProviderAllowed(session.user.id, "search");
    }
    const results = await searchMusicLibrary({
      conversationId: session.conversationId,
      userId: session.user.id,
      q: parsed.data.q,
      discover: parsed.data.discover === "1",
    });
    return NextResponse.json(results);
  } catch (caught) {
    return musicCaught(caught, requestId, "GET /api/music/search", session.user.id);
  }
}
