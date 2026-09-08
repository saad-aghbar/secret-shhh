"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { musicKeys } from "@/features/music/query-keys";
import type { ConversationEvent } from "@/lib/realtime/broadcast";
import { useConversationBroadcast } from "@/lib/realtime/use-conversation-broadcast";

export function useMusicRealtime(conversationId: string) {
  const queryClient = useQueryClient();
  const onEvent = useCallback(
    (event: ConversationEvent) => {
      if (event === "music:changed") {
        void queryClient.invalidateQueries({ queryKey: musicKeys.all });
      }
    },
    [queryClient],
  );
  useConversationBroadcast({
    conversationId,
    events: ["music:changed"],
    onEvent,
  });
}
