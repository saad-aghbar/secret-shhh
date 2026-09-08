import { AppearanceBackButton } from "@/features/appearance/appearance-back-button";
import { AppearanceEditor } from "@/features/appearance/appearance-editor";
import type { PreviewSeed } from "@/features/appearance/appearance-preview";
import { AppShell } from "@/components/shell/app-shell";
import { getAppearanceForUser } from "@/lib/appearance/service";
import { requireAuthorizedUser } from "@/lib/auth/session";
import { getThemeForUser } from "@/lib/theme/service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Appearance",
};

const SAMPLE: PreviewSeed = {
  incoming: "look what I found ♡",
  outgoing: "okay that's actually cute",
  time: "8:12 PM",
};

export default async function AppearancePage() {
  const session = await requireAuthorizedUser();
  const [appearance, themePayload] = await Promise.all([
    getAppearanceForUser({
      userId: session.user.id,
      conversationId: session.conversationId,
    }),
    getThemeForUser(session.user.id),
  ]);

  return (
    <AppShell
      title="Appearance"
      variant="wide"
      subtitle="Make Chat feel like yours."
      headerLeading={<AppearanceBackButton />}
    >
      <AppearanceEditor
        initial={appearance}
        conversationId={session.conversationId}
        userId={session.user.id}
        seed={SAMPLE}
        themePayload={themePayload}
      />
    </AppShell>
  );
}
