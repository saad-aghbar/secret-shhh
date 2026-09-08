"use client";

import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";

import { WallpaperLayer } from "@/features/appearance/wallpaper-layer";
import type { AppearanceTheme } from "@/lib/appearance/config";
import { resolveChatAppearance } from "@/lib/appearance/resolve";
import {
  apiGetAppearance,
  getCachedAppearance,
  rememberAppearance,
  subscribeAppearance,
} from "@/lib/appearance/client-api";
import type { AppearancePayload } from "@/lib/appearance/types";
import { useConversationBroadcast } from "@/lib/realtime/use-conversation-broadcast";

function themeFrom(value?: string): AppearanceTheme {
  return value === "dark" ? "dark" : "light";
}

export function ChatWallpaperHost({
  conversationId,
  initial,
}: {
  conversationId: string;
  initial: AppearancePayload;
}) {
  const { resolvedTheme } = useTheme();
  const theme = themeFrom(resolvedTheme);
  const [payload, setPayload] = useState(() => getCachedAppearance() ?? initial);

  useEffect(() => {
    if (!getCachedAppearance()) rememberAppearance(initial);
  }, [initial]);

  useEffect(() => {
    return subscribeAppearance((next) => setPayload(next));
  }, []);

  useEffect(() => {
    void apiGetAppearance(true).catch(() => undefined);
  }, [conversationId]);

  const onEvent = useCallback(() => {
    void apiGetAppearance(true).catch(() => undefined);
  }, []);

  useConversationBroadcast({
    conversationId,
    events: ["appearance:changed"],
    onEvent,
  });

  const resolved = resolveChatAppearance({
    personal: payload.personal,
    shared: {
      mode: payload.sharedMode,
      config: payload.shared,
      mediaId: "assetId" in payload.shared ? payload.shared.assetId : undefined,
    },
    theme,
  });

  return <WallpaperLayer resolved={resolved} imageUrl={payload.imageUrl} theme={theme} />;
}
