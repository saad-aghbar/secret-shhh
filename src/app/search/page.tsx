import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Search",
};

/**
 * Canonical Search lives at /more/search after Phase 15.
 * Keep /search as a query-preserving redirect so deep links and e2e still work.
 */
export default async function SearchRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) qs.append(key, item);
    } else if (typeof value === "string") {
      qs.set(key, value);
    }
  }
  const suffix = qs.toString();
  redirect(suffix ? `/more/search?${suffix}` : "/more/search");
}
