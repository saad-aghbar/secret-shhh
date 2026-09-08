import { Suspense } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { ChatQueryProvider } from "@/features/chat/query-provider";
import { MediaLibrary } from "@/features/media";
import { requireAuthorizedUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Media",
};

export default async function MediaPage() {
  const session = await requireAuthorizedUser();

  return (
    <AppShell title="Media" variant="wide">
      <ChatQueryProvider>
        {/* useSearchParams drives view/album/filter state; it needs a boundary. */}
        <Suspense fallback={null}>
          <MediaLibrary
            conversationId={session.conversationId}
            userId={session.user.id}
            userName={session.user.displayName}
            partnerId={session.partner?.id ?? null}
            partnerName={session.partner?.displayName ?? "Partner"}
          />
        </Suspense>
      </ChatQueryProvider>
    </AppShell>
  );
}
