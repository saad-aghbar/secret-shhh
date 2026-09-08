import { NextResponse } from "next/server";

import { musicCaught, readJson, withMusicSession } from "@/lib/music/http";
import { addMemory } from "@/lib/music/service";
import { memoryCreateSchema } from "@/lib/music/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { requestId, session, error } = await withMusicSession();
  if (!session) return error!;
  const { id } = await params;
  const json = await readJson(request);
  if (json.error) return json.error;
  const parsed = memoryCreateSchema.safeParse(json.body);
  if (!parsed.success) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "Couldn’t save that memory." }, { status: 400 });
  }
  try {
    const memory = await addMemory({
      conversationId: session.conversationId,
      userId: session.user.id,
      trackId: id,
      text: parsed.data.text,
      clientGeneratedId: parsed.data.clientGeneratedId,
    });
    return NextResponse.json({ memory });
  } catch (caught) {
    return musicCaught(caught, requestId, "POST /api/music/tracks/[id]/memories", session.user.id);
  }
}
