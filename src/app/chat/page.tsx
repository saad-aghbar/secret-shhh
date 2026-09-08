import { Suspense } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { ShhhAvatar, ShhhSpinner } from "@/components/shhh";
import { ChatCallActions } from "@/features/calls/chat-call-actions";
import { ChatExperience } from "@/features/chat/chat-experience";
import { ChatQueryProvider } from "@/features/chat/query-provider";
import { PartnerPresenceBadge } from "@/features/presence/partner-presence-badge";
import { getAppearanceForUser } from "@/lib/appearance/service";
import { getPartnerPresence } from "@/lib/auth/presence";
import { requireAuthorizedUser } from "@/lib/auth/session";
import { getRecentMessages } from "@/lib/chat/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Chat",
};

export default async function ChatPage() {
  const session = await requireAuthorizedUser();
  const partnerName = session.partner?.displayName ?? "your person";
  const presence = await getPartnerPresence(session.partner?.id ?? null);
  const [recent, appearance] = await Promise.all([
    getRecentMessages(session.conversationId, session.user.id),
    getAppearanceForUser({
      userId: session.user.id,
      conversationId: session.conversationId,
    }),
  ]);
  const initials = partnerName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <AppShell
      variant="chat"
      title={partnerName}
      conversationId={session.conversationId}
      appearance={appearance}
      headerLeading={<ShhhAvatar initials={initials} size="sm" alt={partnerName} />}
      brandSubtitle={<PartnerPresenceBadge initial={presence} variant="compact" />}
      actions={<ChatCallActions />}
    >
      <ChatQueryProvider>
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center py-16">
              <ShhhSpinner label="Loading chat" />
            </div>
          }
        >
          <ChatExperience
            userId={session.user.id}
            conversationId={session.conversationId}
            selfName={session.user.displayName}
            partnerName={partnerName}
            initialMessages={recent.messages}
          />
        </Suspense>
      </ChatQueryProvider>
    </AppShell>
  );
}
