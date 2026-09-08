"use client";

import { useEffect, useRef } from "react";

import type { ConversationEvent } from "@/lib/realtime/broadcast";
import {
  conversationChannelName,
  createRealtimeClient,
  isRealtimeConfigured,
} from "@/lib/realtime/supabase";
import { getRealtimeTestBus } from "@/lib/realtime/test-bus";

export type BroadcastHandler = (
  event: ConversationEvent,
  payload: Record<string, unknown>,
) => void;

/**
 * Listen-only conversation broadcast subscription over both the Supabase
 * channel and the Playwright test bus. Realtime stays an enhancement:
 * callers reconcile over HTTP, so a dropped event only delays convergence.
 */
export function useConversationBroadcast(params: {
  conversationId: string;
  events: readonly ConversationEvent[];
  onEvent: BroadcastHandler;
  enabled?: boolean;
}) {
  const { conversationId, enabled = true } = params;
  const handler = useRef(params.onEvent);
  // Stable subscription identity: re-subscribing on every render would drop events.
  const eventKey = [...params.events].sort().join(",");

  useEffect(() => {
    handler.current = params.onEvent;
  }, [params.onEvent]);

  useEffect(() => {
    if (!enabled) return;
    const events = eventKey.split(",") as ConversationEvent[];
    const bus = getRealtimeTestBus();
    return bus.subscribe(conversationId, (event, payload) => {
      if (events.includes(event as ConversationEvent)) {
        handler.current(event as ConversationEvent, payload);
      }
    });
  }, [conversationId, eventKey, enabled]);

  useEffect(() => {
    if (!enabled || !isRealtimeConfigured()) return;
    const client = createRealtimeClient();
    if (!client) return;

    const events = eventKey.split(",") as ConversationEvent[];
    let channel = client.channel(conversationChannelName(conversationId), {
      config: { broadcast: { self: false } },
    });

    for (const event of events) {
      channel = channel.on("broadcast", { event }, ({ payload }) => {
        handler.current(event, (payload ?? {}) as Record<string, unknown>);
      });
    }
    channel.subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [conversationId, eventKey, enabled]);
}
