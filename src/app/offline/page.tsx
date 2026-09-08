import Link from "next/link";

import { DoodleUnderline } from "@/components/shhh";
import { OfflineRecent } from "@/features/pwa/offline-recent";
import { publicEnv } from "@/lib/public-env";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Offline",
};

export default function OfflinePage() {
  return (
    <div
      data-testid="offline-shell"
      className="flex min-h-dvh flex-col px-4"
      style={{
        background: "var(--shhh-bg)",
        paddingTop: "var(--shhh-safe-top)",
        paddingBottom: "var(--shhh-safe-bottom)",
      }}
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10 text-center">
        <p className="font-handmade text-4xl tracking-tight text-primary-text">
          {publicEnv.NEXT_PUBLIC_APP_NAME}
        </p>
        <DoodleUnderline className="mx-auto mt-1 h-2.5 w-24" aria-hidden />
        <p className="mt-6 text-sm text-secondary-text" role="status">
          You’re offline. Recent chat on this device is still here.
        </p>
        <Link
          href="/"
          className="shhh-press bg-button text-on-button mt-6 inline-flex min-h-12 items-center justify-center rounded-full px-6 text-base font-semibold"
        >
          Retry
        </Link>
        <OfflineRecent />
      </div>
    </div>
  );
}
