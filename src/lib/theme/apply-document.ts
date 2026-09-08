"use client";

import { THEME_STYLE_ID } from "@/lib/theme/css";

export const THEME_CHANNEL = "shhh.theme";

export function applyThemeCss(css: string) {
  if (typeof document === "undefined") return;
  const existing = document.getElementById(THEME_STYLE_ID) as HTMLStyleElement | null;
  if (!css) {
    existing?.remove();
    return;
  }
  const el = existing ?? document.createElement("style");
  el.id = THEME_STYLE_ID;
  el.textContent = css;
  if (!existing) document.head.appendChild(el);
}

export function playThemeTransition() {
  if (typeof document === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const root = document.documentElement;
  root.classList.add("shhh-theme-animating");
  window.setTimeout(() => {
    root.classList.remove("shhh-theme-animating");
  }, 180);
}

export function publishThemeChange(userId?: string) {
  if (typeof BroadcastChannel === "undefined") return;
  try {
    const channel = new BroadcastChannel(THEME_CHANNEL);
    channel.postMessage({ type: "theme:changed", userId: userId ?? null });
    channel.close();
  } catch {
    // BroadcastChannel can fail in some private contexts.
  }
}

export function syncThemeColor(background: string) {
  if (typeof document === "undefined") return;
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  if (metas.length === 0) {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("content", background);
    document.head.appendChild(meta);
    return;
  }
  for (const meta of metas) {
    meta.setAttribute("content", background);
  }
}
