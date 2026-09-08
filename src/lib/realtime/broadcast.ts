import { logWarn } from "@/lib/logger";
import { conversationChannelName, createRealtimeClient } from "@/lib/realtime/supabase";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

export type ConversationEvent =
  | "message:new"
  | "message:edited"
  | "message:deleted"
  | "reaction:changed"
  | "receipt:update"
  | "typing:start"
  | "typing:stop"
  /* Phase 5 media library. Payloads carry ids only; HTTP refetch resolves state. */
  | "media:changed"
  | "album:changed"
  | "favorite:changed"
  | "appearance:changed"
  | "call:incoming"
  | "call:accepted"
  | "call:declined"
  | "call:cancelled"
  | "call:ended"
  | "call:updated"
  | "music:changed";

export type BroadcastPayload = Record<string, string | number | boolean | string[] | null | undefined>;

type CachedChannel = {
  client: SupabaseClient;
  channel: RealtimeChannel;
  ready: Promise<void>;
};

const channelCache = new Map<string, CachedChannel>();

async function getSubscribedChannel(conversationId: string): Promise<CachedChannel | null> {
  const client = createRealtimeClient();
  if (!client) {
    return null;
  }

  const existing = channelCache.get(conversationId);
  if (existing) {
    await existing.ready;
    return existing;
  }

  const channel = client.channel(conversationChannelName(conversationId), {
    config: { broadcast: { ack: true } },
  });

  const ready = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("realtime_subscribe_timeout"));
    }, 4_000);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timeout);
        resolve();
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(timeout);
        channelCache.delete(conversationId);
        reject(new Error(status));
      }
    });
  });

  const entry = { client, channel, ready };
  channelCache.set(conversationId, entry);
  try {
    await ready;
    return entry;
  } catch (error) {
    channelCache.delete(conversationId);
    await client.removeChannel(channel).catch(() => undefined);
    throw error;
  }
}

/**
 * Notification-only. Payload must never include message bodies.
 * Reuses a subscribed channel per conversation so receipt bursts stay reliable.
 * No-ops when Realtime env is not configured.
 */
export async function broadcastConversationEvent(
  conversationId: string,
  event: ConversationEvent,
  payload: BroadcastPayload = {},
) {
  try {
    const entry = await getSubscribedChannel(conversationId);
    if (!entry) {
      return;
    }
    const result = await entry.channel.send({
      type: "broadcast",
      event,
      payload,
    });
    if (result !== "ok") {
      logWarn({
        operation: "realtime.broadcast",
        extra: { event, result: String(result) },
      });
    }
  } catch {
    logWarn({
      operation: "realtime.broadcast",
      extra: { event },
    });
    channelCache.delete(conversationId);
  }
}
