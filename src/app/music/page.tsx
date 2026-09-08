import { Suspense } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { ChatQueryProvider } from "@/features/chat/query-provider";
import { MusicExperience } from "@/features/music/music-experience";
import { requireAuthorizedUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Music",
};

export default async function MusicPage() {
  const session = await requireAuthorizedUser();

  return (
    <AppShell title="Music" variant="wide">
      <ChatQueryProvider>
        <Suspense fallback={null}>
          <MusicExperience
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
