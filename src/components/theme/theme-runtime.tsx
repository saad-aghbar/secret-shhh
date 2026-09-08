"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

import { applyThemeCss, syncThemeColor, THEME_CHANNEL } from "@/lib/theme/apply-document";
import { apiGetTheme, rememberTheme, subscribeTheme } from "@/lib/theme/client-api";
import { themeCssText } from "@/lib/theme/css";
import type { ThemePayload } from "@/lib/theme/types";

function backgroundFor(payload: ThemePayload, resolvedTheme: string | undefined) {
  return resolvedTheme === "dark" ? payload.resolvedDark.tokens.bg : payload.resolvedLight.tokens.bg;
}

export function ThemeRuntime({
  userId,
  initial,
}: {
  userId?: string;
  initial?: ThemePayload | null;
}) {
  const { resolvedTheme, setTheme, theme } = useTheme();

  useEffect(() => {
    if (initial) rememberTheme(initial);
  }, [initial]);

  useEffect(() => {
    return subscribeTheme((payload) => {
      applyThemeCss(themeCssText(payload.resolvedLight, payload.resolvedDark));
      syncThemeColor(backgroundFor(payload, resolvedTheme));
    });
  }, [resolvedTheme]);

  useEffect(() => {
    const cached = initial;
    if (cached) syncThemeColor(backgroundFor(cached, resolvedTheme));
  }, [initial, resolvedTheme]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(THEME_CHANNEL);
    channel.onmessage = (event: MessageEvent<{ type?: string; userId?: string | null }>) => {
      if (event.data?.type !== "theme:changed") return;
      if (userId && event.data.userId && event.data.userId !== userId) return;
      void apiGetTheme(true).then((payload) => {
        applyThemeCss(themeCssText(payload.resolvedLight, payload.resolvedDark));
      });
    };
    return () => channel.close();
  }, [userId]);

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    const key = `shhh.theme.${userId}`;
    if (window.localStorage.getItem(key)) return;
    const legacy = window.localStorage.getItem("theme");
    if (legacy === "light" || legacy === "dark" || legacy === "system") {
      if (legacy !== theme) setTheme(legacy);
    }
  }, [setTheme, theme, userId]);

  return null;
}
