import Link from "next/link";
import { ChevronRight, Palette, Search, Shield } from "lucide-react";

import { AppShell } from "@/components/shell/app-shell";
import { ShhhCard } from "@/components/shhh";
import { AccountPanel } from "@/features/auth/account-panel";
import { InstallShhh } from "@/features/pwa/install-shhh";
import { QuickLockButton } from "@/features/privacy/quick-lock-button";
import { PhotoDownloadSettings } from "@/features/settings/photo-download-settings";
import { getPartnerPresence } from "@/lib/auth/presence";
import { requireAuthorizedUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "More",
};

export default async function MorePage() {
  const session = await requireAuthorizedUser();
  const partnerPresence = await getPartnerPresence(session.partner?.id ?? null);

  return (
    <AppShell title="More">
      <div className="flex flex-1 flex-col gap-6">
        <AccountPanel
          displayName={session.user.displayName}
          nickname={session.user.nickname}
          slot={session.slot}
          partnerPresence={partnerPresence}
        />
        <QuickLockButton />
        <Link
          href="/more/privacy"
          data-testid="privacy-entry"
          className="shhh-press block rounded-[var(--shhh-radius-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)]"
        >
          <ShhhCard>
            <div className="flex items-center gap-3">
              <span className="bg-accent-soft text-accent grid size-11 place-items-center rounded-full">
                <Shield className="size-5" strokeWidth={2} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-primary-text">Privacy</span>
                <span className="mt-0.5 block text-sm text-secondary-text">
                  Discreet mode, lock, and a quiet home screen.
                </span>
              </span>
              <ChevronRight className="text-muted-text size-5 shrink-0" aria-hidden />
            </div>
          </ShhhCard>
        </Link>
        <InstallShhh />
        <Link
          href="/more/appearance"
          data-testid="appearance-entry"
          className="shhh-press block rounded-[var(--shhh-radius-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)]"
        >
          <ShhhCard>
            <div className="flex items-center gap-3">
              <span className="bg-accent-soft text-accent grid size-11 place-items-center rounded-full">
                <Palette className="size-5" strokeWidth={2} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-primary-text">Appearance</span>
                <span className="mt-0.5 block text-sm text-secondary-text">
                  Wallpaper, Light, Dark, and your colors.
                </span>
              </span>
              <ChevronRight className="text-muted-text size-5 shrink-0" aria-hidden />
            </div>
          </ShhhCard>
        </Link>
        <Link
          href="/more/search"
          data-testid="search-entry"
          className="shhh-press block rounded-[var(--shhh-radius-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)]"
        >
          <ShhhCard>
            <div className="flex items-center gap-3">
              <span className="bg-accent-soft text-accent grid size-11 place-items-center rounded-full">
                <Search className="size-5" strokeWidth={2} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-primary-text">Search</span>
                <span className="mt-0.5 block text-sm text-secondary-text">
                  Find messages, photos, calls, and songs.
                </span>
              </span>
              <ChevronRight className="text-muted-text size-5 shrink-0" aria-hidden />
            </div>
          </ShhhCard>
        </Link>
        <ShhhCard title="Data" description="Photos, videos, and calls on a slower connection.">
          <PhotoDownloadSettings />
        </ShhhCard>
      </div>
    </AppShell>
  );
}
