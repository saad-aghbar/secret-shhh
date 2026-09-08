import { AppShell } from "@/components/shell/app-shell";
import { PrivacySettings } from "@/features/privacy/privacy-settings";
import { requireAuthorizedUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Privacy",
};

export default async function PrivacyPage() {
  await requireAuthorizedUser();
  return (
    <AppShell title="Privacy">
      <PrivacySettings />
    </AppShell>
  );
}
