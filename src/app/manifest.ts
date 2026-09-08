import type { MetadataRoute } from "next";

import { publicEnv } from "@/lib/public-env";

const LIGHT_SURFACE = "#f3efe8";
const DARK_SURFACE = "#14110f";

/**
 * Discreet installed name. Do not put couple names, "private chat",
 * or a description — those show up in the OS install sheet.
 *
 * Alternate discreet icon/name: swap this object. Installed PWAs cannot
 * change icon or name dynamically on iOS or Android.
 */
export default function manifest(): MetadataRoute.Manifest {
  const name = publicEnv.NEXT_PUBLIC_APP_NAME;
  return {
    name,
    short_name: name,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: LIGHT_SURFACE,
    theme_color: LIGHT_SURFACE,
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Web Share Target. iOS cannot invoke this; paste-link remains the always-working path.
    share_target: {
      action: "/music/share",
      method: "GET",
      enctype: "application/x-www-form-urlencoded",
      params: {
        title: "title",
        text: "text",
        url: "url",
      },
    },
  } as MetadataRoute.Manifest;
}

export const darkSplash = DARK_SURFACE;
