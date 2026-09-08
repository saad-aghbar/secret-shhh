import { type NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/constants";
import { isAllowedMutationOrigin, isStateChangingMethod } from "@/lib/http/origin";
import { forbidden } from "@/lib/http/api-error";

const PRIVATE_PREFIXES = ["/chat", "/media", "/music", "/search", "/more"];

function isPrivatePath(pathname: string) {
  return PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Lightweight gate: require session cookie for private routes.
 * Full validation (expiry, revocation, user) happens in requireAuthorizedUser().
 *
 * Do not redirect Server Actions or /login when a cookie already exists:
 * same-origin tabs share one cookie, and redirecting those POSTs/RSC
 * payloads surfaces as "An unexpected response was received from the server."
 * /login stays reachable so a tab can switch identity (overwrites the cookie).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isServerAction = request.headers.has("next-action");

  if (
    pathname.startsWith("/api/") &&
    pathname !== "/api/health" &&
    isStateChangingMethod(request.method) &&
    !isAllowedMutationOrigin(request)
  ) {
    return forbidden();
  }

  if (pathname === "/search" || pathname.startsWith("/search/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/search/, "/more/search") || "/more/search";
    return NextResponse.redirect(url);
  }

  if (isPrivatePath(pathname) && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === "/" && hasSession && !isServerAction) {
    const url = request.nextUrl.clone();
    url.pathname = "/chat";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
