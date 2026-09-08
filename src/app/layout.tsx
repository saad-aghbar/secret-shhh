import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Gaegu, Nunito, Tajawal } from "next/font/google";

import { DevServiceWorkerReset } from "@/components/pwa/dev-service-worker-reset";
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker-registrar";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeRuntime } from "@/components/theme/theme-runtime";
import { ThemeStyle } from "@/components/theme/theme-style";
import { CallSessionHost } from "@/features/calls/call-session-host";
import { ChatQueryProvider } from "@/features/chat/query-provider";
import { MusicPlayerProvider } from "@/features/music/music-player-provider";
import { PrivacyProvider } from "@/features/privacy/privacy-provider";
import { getOptionalAuthorizedUser } from "@/lib/auth/session";
import {
  readHiddenAtCookie,
  readLockCookie,
} from "@/lib/privacy/lock-cookie";
import { isServerLocked } from "@/lib/privacy/policy";
import { getPrivacySettingsForUser } from "@/lib/privacy/preferences";
import { DEFAULT_PRIVACY_SETTINGS } from "@/lib/privacy/settings";
import { publicEnv } from "@/lib/public-env";
import { themeCssText } from "@/lib/theme/css";
import { emptyThemePayload, getThemeForUser } from "@/lib/theme/service";

import "./globals.css";

const ui = Nunito({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const handmade = Gaegu({
  variable: "--font-handmade",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

/** Arabic-capable fallback for conversation content only — not app chrome. */
const arabic = Tajawal({
  variable: "--font-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: publicEnv.NEXT_PUBLIC_APP_NAME,
    template: publicEnv.NEXT_PUBLIC_APP_NAME,
  },
  description: publicEnv.NEXT_PUBLIC_APP_NAME,
  applicationName: publicEnv.NEXT_PUBLIC_APP_NAME,
  robots: { index: false, follow: false, nocache: true },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: publicEnv.NEXT_PUBLIC_APP_NAME,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3efe8" },
    { media: "(prefers-color-scheme: dark)", color: "#14110f" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  let session = null;
  try {
    session = await getOptionalAuthorizedUser();
  } catch {
    session = null;
  }
  let theme = emptyThemePayload();
  if (session) {
    try {
      theme = await getThemeForUser(session.user.id);
    } catch {
      theme = emptyThemePayload();
    }
  }
  const css = themeCssText(theme.resolvedLight, theme.resolvedDark);
  let privacy = DEFAULT_PRIVACY_SETTINGS;
  let serverLocked = false;
  if (session) {
    try {
      privacy = await getPrivacySettingsForUser(session.user.id);
    } catch {
      privacy = DEFAULT_PRIVACY_SETTINGS;
    }
    try {
      const fetchSite = (await headers()).get("sec-fetch-site");
      serverLocked = isServerLocked({
        lockCookie: await readLockCookie(),
        hiddenAtCookie: await readHiddenAtCookie(),
        lockOnLeave: privacy.lockOnLeave,
        ignoreHiddenAt: fetchSite === "same-origin" || fetchSite === "same-site",
      });
    } catch {
      serverLocked = false;
    }
  }

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${ui.variable} ${handmade.variable} ${arabic.variable} h-full`}
    >
      <body className="min-h-full bg-background font-sans text-primary-text antialiased">
        <DevServiceWorkerReset />
        <ThemeStyle css={css} />
        <ThemeProvider userId={session?.user.id} defaultTheme={theme.mode}>
          <ThemeRuntime userId={session?.user.id} initial={session ? theme : null} />
          <ServiceWorkerRegistrar />
          <PrivacyProvider initialLocked={serverLocked} initialSettings={privacy}>
            <ChatQueryProvider>
              <MusicPlayerProvider>
                <CallSessionHost enabled={Boolean(session)}>
                  {children}
                </CallSessionHost>
              </MusicPlayerProvider>
            </ChatQueryProvider>
          </PrivacyProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
