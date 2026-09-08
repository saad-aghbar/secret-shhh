import { and, eq } from "drizzle-orm";

import { getConversationPartnerId } from "@/lib/chat/access";
import { getMessageByClientGeneratedId, getMessageById } from "@/lib/chat/queries";
import { assertReplyTarget } from "@/lib/chat/reply-target";
import { ChatValidationError } from "@/lib/chat/send";
import type { ChatMessage } from "@/lib/chat/types";
import { getDb } from "@/lib/db";
import { messageReceipts, messages, musicMessageShares, musicTrackSources } from "@/lib/db/schema";
import { validateClipRange } from "@/lib/music/clip";
import { isYouTubeVideoId } from "@/lib/music/providers/youtube-id";
import { requireTrack } from "@/lib/music/store";
import { logError, logInfo } from "@/lib/logger";
import { broadcastConversationEvent } from "@/lib/realtime/broadcast";

export async function sendMusicMessage(params: {
  requestId: string;
  userId: string;
  conversationId: string;
  trackId: string;
  clientGeneratedId: string;
  text?: string;
  replyToMessageId?: string;
  clipStartMs?: number;
  clipEndMs?: number;
  youtubeVideoId?: string;
}): Promise<ChatMessage> {
  const started = Date.now();
  const existing = await getMessageByClientGeneratedId(
    params.userId,
    params.clientGeneratedId,
    params.userId,
  );
  if (existing) return existing;

  const track = await requireTrack(params.conversationId, params.trackId);
  const youtubeVideoId = params.youtubeVideoId ?? track.youtubeVideoId;
  if (youtubeVideoId && !isYouTubeVideoId(youtubeVideoId)) {
    throw new ChatValidationError("This version can’t play here.");
  }
  if (params.youtubeVideoId) {
    const db = getDb();
    const sources = await db
      .select({
        provider: musicTrackSources.provider,
        externalId: musicTrackSources.externalId,
      })
      .from(musicTrackSources)
      .where(eq(musicTrackSources.trackId, track.id));
    const belongs =
      params.youtubeVideoId === track.youtubeVideoId ||
      sources.some(
        (source) =>
          (source.provider === "youtube" || source.provider === "youtube_music") &&
          source.externalId === params.youtubeVideoId,
      );
    if (!belongs) {
      throw new ChatValidationError("That version doesn’t belong to this song.");
    }
  }
  if (params.clipStartMs != null || params.clipEndMs != null) {
    if (params.clipStartMs == null || params.clipEndMs == null) {
      throw new ChatValidationError("Choose a short part of the song.");
    }
    try {
      validateClipRange({
        startMs: params.clipStartMs,
        endMs: params.clipEndMs,
        durationMs: track.durationMs,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      if (reason === "clip_too_long") {
        throw new ChatValidationError("Clips can be up to 30 seconds.");
      }
      throw new ChatValidationError("Choose a short part of the song.");
    }
  }

  if (params.replyToMessageId) {
    await assertReplyTarget({
      conversationId: params.conversationId,
      replyToMessageId: params.replyToMessageId,
    });
  }

  const partnerId = await getConversationPartnerId(params.conversationId, params.userId);
  const db = getDb();
  try {
    const inserted = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(messages)
        .values({
          conversationId: params.conversationId,
          senderId: params.userId,
          clientGeneratedId: params.clientGeneratedId,
          type: "music",
          textContent: params.text ?? "",
          replyToMessageId: params.replyToMessageId,
          metadata: {},
        })
        .onConflictDoNothing({
          target: [messages.senderId, messages.clientGeneratedId],
        })
        .returning();
      const message =
        row ??
        (
          await tx
            .select()
            .from(messages)
            .where(
              and(
                eq(messages.senderId, params.userId),
                eq(messages.clientGeneratedId, params.clientGeneratedId),
              ),
            )
            .limit(1)
        )[0];
      if (!message) throw new Error("insert_failed");
      if (row) {
        await tx.insert(musicMessageShares).values({
          messageId: message.id,
          trackId: track.id,
          youtubeVideoId,
          clipStartMs: params.clipStartMs ?? null,
          clipEndMs: params.clipEndMs ?? null,
        });
        if (partnerId) {
          await tx.insert(messageReceipts).values({ messageId: message.id, userId: partnerId }).onConflictDoNothing();
        }
      }
      return message;
    });

    const serialized =
      (await getMessageById(params.conversationId, params.userId, inserted.id)) ??
      (await getMessageByClientGeneratedId(params.userId, params.clientGeneratedId, params.userId))!;
    logInfo({
      requestId: params.requestId,
      operation: "sendMusicMessage",
      userId: params.userId,
      durationMs: Date.now() - started,
    });
    void broadcastConversationEvent(params.conversationId, "message:new", { messageId: serialized.id });
    return serialized;
  } catch (error) {
    if (error instanceof ChatValidationError) throw error;
    logError({
      requestId: params.requestId,
      operation: "sendMusicMessage",
      userId: params.userId,
      errorClass: error instanceof Error ? error.name : "unknown",
      durationMs: Date.now() - started,
    });
    throw error;
  }
}
