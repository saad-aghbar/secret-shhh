import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { mediaFavorites } from "@/lib/db/schema";
import { logInfo } from "@/lib/logger";
import { MediaValidationError, getAuthorizedMediaRow } from "@/lib/media/service";

export type FavoriteState = {
  mediaId: string;
  favoritedBy: string[];
};

/**
 * Per-person heart. Idempotent so repeated taps or retried requests converge.
 * "Loved by both" is derived from the resulting rows, never written separately.
 */
export async function setMediaFavorite(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  mediaId: string;
  favorite: boolean;
}): Promise<FavoriteState> {
  const row = await getAuthorizedMediaRow({
    mediaId: params.mediaId,
    userId: params.userId,
    conversationId: params.conversationId,
  });
  if (!row) {
    throw new MediaValidationError("That isn't available.");
  }

  const db = getDb();
  if (params.favorite) {
    await db
      .insert(mediaFavorites)
      .values({ mediaId: params.mediaId, userId: params.userId })
      .onConflictDoNothing({
        target: [mediaFavorites.mediaId, mediaFavorites.userId],
      });
  } else {
    await db
      .delete(mediaFavorites)
      .where(
        and(eq(mediaFavorites.mediaId, params.mediaId), eq(mediaFavorites.userId, params.userId)),
      );
  }

  const rows = await db
    .select({ userId: mediaFavorites.userId })
    .from(mediaFavorites)
    .where(eq(mediaFavorites.mediaId, params.mediaId));

  logInfo({
    requestId: params.requestId,
    operation: "setMediaFavorite",
    userId: params.userId,
    extra: { mediaId: params.mediaId, favorite: params.favorite },
  });

  return { mediaId: params.mediaId, favoritedBy: rows.map((entry) => entry.userId) };
}
