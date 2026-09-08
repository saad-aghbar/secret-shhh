import { redirect } from "next/navigation";

import { requireAuthorizedUser } from "@/lib/auth/session";
import { tryParseMusicUrl } from "@/lib/music/providers/urls";

export const dynamic = "force-dynamic";

/**
 * PWA share target. Android can POST/GET a URL here; iOS Share Sheet cannot
 * target an installed PWA, so paste-link on /music always remains the path.
 */
export default async function MusicSharePage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string; text?: string; title?: string }>;
}) {
  await requireAuthorizedUser();
  const params = await searchParams;
  const candidate = params.url || params.text || params.title || "";
  const parsed = tryParseMusicUrl(candidate);
  const sharedUrl = parsed?.canonicalUrl || extractUrl(candidate);
  const qs = new URLSearchParams({ add: "1" });
  if (sharedUrl) qs.set("url", sharedUrl);
  redirect(`/music?${qs.toString()}`);
}

function extractUrl(text: string) {
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match?.[0] ?? (text.startsWith("http") ? text : "");
}
