import { eq } from "drizzle-orm";

import { InteractionError } from "@/lib/chat/interaction-error";
import { getDb } from "@/lib/db";
import { messages } from "@/lib/db/schema";

export async function assertReplyTarget(params: {
  conversationId: string;
  replyToMessageId: string;
}): Promise<void> {
  const db = getDb();
  const row = (
    await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        deletedAt: messages.deletedAt,
      })
      .from(messages)
      .where(eq(messages.id, params.replyToMessageId))
      .limit(1)
  )[0];

  if (!row) {
    throw new InteractionError("NOT_FOUND", "That message is gone.", 404);
  }
  if (row.conversationId !== params.conversationId) {
    throw new InteractionError("FORBIDDEN", "You can’t reply to that.", 403);
  }
  if (row.deletedAt) {
    throw new InteractionError("VALIDATION_ERROR", "That message was deleted.", 400);
  }
}
