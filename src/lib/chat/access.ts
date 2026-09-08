import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { conversationMembers } from "@/lib/db/schema";

export async function authorizeConversationAccess(userId: string, conversationId: string) {
  const db = getDb();
  const row = (
    await db
      .select({ userId: conversationMembers.userId })
      .from(conversationMembers)
      .where(
        and(
          eq(conversationMembers.conversationId, conversationId),
          eq(conversationMembers.userId, userId),
        ),
      )
      .limit(1)
  )[0];

  return Boolean(row);
}

export async function getConversationPartnerId(conversationId: string, userId: string) {
  const db = getDb();
  const members = await db
    .select({ userId: conversationMembers.userId })
    .from(conversationMembers)
    .where(eq(conversationMembers.conversationId, conversationId));

  const partner = members.find((member) => member.userId !== userId);
  return partner?.userId ?? null;
}
