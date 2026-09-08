import path from "node:path";
import type { NextConfig } from "next";

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://www.youtube.com https://www.youtube-nocookie.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://i.ytimg.com https://*.ytimg.com https://i.scdn.co https://*.scdn.co https://*.mzstatic.com https://*.r2.cloudflarestorage.com",
  "media-src 'self' blob: https://*.r2.cloudflarestorage.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://livekit.cloud https://*.livekit.cloud wss://livekit.cloud wss://*.livekit.cloud https://*.livekit.io wss://*.livekit.io https://*.r2.cloudflarestorage.com https://www.googleapis.com https://accounts.spotify.com https://api.spotify.com https://itunes.apple.com https://*.mzstatic.com https://i.ytimg.com https://www.youtube.com https://*.youtube.com",
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
  "worker-src 'self' blob:",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["heic-to"],
  // Keep Turbopack rooted to this package (avoids parent lockfile confusion).
  turbopack: {
    root: path.join(__dirname),
  },
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
          {
            key: "Permissions-Policy",
            value:
              "camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), bluetooth=(), display-capture=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
