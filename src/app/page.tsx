import { redirect } from "next/navigation";

import { getOptionalAuthorizedUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Authenticated home is the single permanent chat — no conversation list. */
export default async function HomePage() {
  const session = await getOptionalAuthorizedUser();
  if (session) {
    redirect("/chat");
  }
  redirect("/login");
}
