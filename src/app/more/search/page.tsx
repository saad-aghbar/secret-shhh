import { Suspense } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { ShhhSpinner } from "@/components/shhh";
import { ChatQueryProvider } from "@/features/chat/query-provider";
import { SearchBackButton } from "@/features/search/search-back-button";
import { SearchExperience } from "@/features/search/search-experience";
import { requireAuthorizedUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Search",
};

export default async function MoreSearchPage() {
  const session = await requireAuthorizedUser();
  const partnerName = session.partner?.displayName ?? "Partner";

  return (
    <AppShell title="Search" headerLeading={<SearchBackButton />}>
      <ChatQueryProvider>
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center py-16">
              <ShhhSpinner label="Loading search" />
            </div>
          }
        >
          <SearchExperience userId={session.user.id} partnerName={partnerName} />
        </Suspense>
      </ChatQueryProvider>
    </AppShell>
  );
}
