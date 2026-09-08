import { and, eq, ne } from "drizzle-orm";

import type { ProfileSlot } from "@/lib/auth/profiles";
import { getDb } from "@/lib/db";
import {
  conversationMembers,
  conversations,
  userPreferences,
  users,
} from "@/lib/db/schema";

export type AppUser = typeof users.$inferSelect;

export type BootstrapResult = {
  user: AppUser;
  conversationId: string;
  partner: AppUser | null;
};

/**
 * Idempotent upsert by profileSlot + singleton conversation membership.
 * Seeds passwordHash from env on first create, or when the column is still empty.
 */
export async function bootstrapUserBySlot(params: {
  slot: ProfileSlot;
  displayName: string;
  passwordHash?: string | null;
}): Promise<BootstrapResult> {
  const db = getDb();
  const now = new Date();

  return db.transaction(async (tx) => {
    const existing = (
      await tx.select().from(users).where(eq(users.profileSlot, params.slot)).limit(1)
    )[0];

    let user: AppUser;
    if (existing) {
      const [updated] = await tx
        .update(users)
        .set({
          displayName: existing.displayName || params.displayName,
          // Seed hash once if missing (first login after migration / env bootstrap).
          passwordHash: existing.passwordHash ?? params.passwordHash ?? null,
          updatedAt: now,
        })
        .where(eq(users.id, existing.id))
        .returning();
      user = updated;
    } else {
      const [created] = await tx
        .insert(users)
        .values({
          profileSlot: params.slot,
          displayName: params.displayName,
          passwordHash: params.passwordHash ?? null,
          updatedAt: now,
        })
        .returning();
      user = created;
    }

    const prefs = await tx
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, user.id))
      .limit(1);
    if (prefs.length === 0) {
      await tx.insert(userPreferences).values({ userId: user.id });
    }

    let conversation = (await tx.select().from(conversations).limit(1))[0];
    if (!conversation) {
      const [createdConversation] = await tx
        .insert(conversations)
        .values({ title: "Ours", updatedAt: now })
        .returning();
      conversation = createdConversation;
    }

    const membership = await tx
      .select()
      .from(conversationMembers)
      .where(
        and(
          eq(conversationMembers.conversationId, conversation.id),
          eq(conversationMembers.userId, user.id),
        ),
      )
      .limit(1);

    if (membership.length === 0) {
      await tx.insert(conversationMembers).values({
        conversationId: conversation.id,
        userId: user.id,
      });
    }

    const partnerMembership = (
      await tx
        .select()
        .from(conversationMembers)
        .where(
          and(
            eq(conversationMembers.conversationId, conversation.id),
            ne(conversationMembers.userId, user.id),
          ),
        )
        .limit(1)
    )[0];

    const partner = partnerMembership
      ? ((
          await tx
            .select()
            .from(users)
            .where(eq(users.id, partnerMembership.userId))
            .limit(1)
        )[0] ?? null)
      : null;

    return { user, conversationId: conversation.id, partner };
  });
}

export async function updateUserPasswordHash(userId: string, passwordHash: string) {
  const db = getDb();
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId));
}
