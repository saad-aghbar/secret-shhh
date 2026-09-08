import { NextResponse } from "next/server";

import { musicCaught, withMusicSession } from "@/lib/music/http";
import { deleteMemory } from "@/lib/music/service";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { requestId, session, error } = await withMusicSession();
  if (!session) return error!;
  const { id } = await params;
  try {
    await deleteMemory({ conversationId: session.conversationId, userId: session.user.id, memoryId: id });
    return NextResponse.json({ ok: true });
  } catch (caught) {
    return musicCaught(caught, requestId, "DELETE /api/music/memories/[id]", session.user.id);
  }
}
