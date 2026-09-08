import { notFound } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { ThemeBackButton } from "@/features/theme/theme-back-button";
import { ThemeEditor } from "@/features/theme/theme-editor";
import { requireAuthorizedUser } from "@/lib/auth/session";
import type { ThemeMode } from "@/lib/theme/config";
import { getThemeForUser } from "@/lib/theme/service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ mode: string }> };

export async function generateMetadata({ params }: Params) {
  const { mode } = await params;
  return {
    title: mode === "dark" ? "Customize Dark" : "Customize Light",
  };
}

export default async function ThemeEditorPage({ params }: Params) {
  const { mode } = await params;
  if (mode !== "light" && mode !== "dark") notFound();
  const target = mode as ThemeMode;
  const session = await requireAuthorizedUser();
  const theme = await getThemeForUser(session.user.id);

  return (
    <AppShell
      title={target === "light" ? "Customize Light" : "Customize Dark"}
      variant="wide"
      subtitle={
        target === "light"
          ? "This look is only for Light."
          : "This look is only for Dark."
      }
      headerLeading={<ThemeBackButton />}
    >
      <ThemeEditor initial={theme} target={target} userId={session.user.id} />
    </AppShell>
  );
}
