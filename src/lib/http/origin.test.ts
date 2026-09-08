import { describe, expect, it } from "vitest";

import { isAllowedMutationOrigin } from "@/lib/http/origin";

function request(input: {
  origin?: string;
  site?: string;
  url?: string;
}) {
  const headers = new Headers();
  if (input.origin) headers.set("origin", input.origin);
  if (input.site) headers.set("sec-fetch-site", input.site);
  return new Request(input.url ?? "http://127.0.0.1:3000/api/messages", {
    method: "POST",
    headers,
  });
}

describe("mutation origin", () => {
  it("allows same-origin browser fetches", () => {
    expect(
      isAllowedMutationOrigin(
        request({ origin: "http://127.0.0.1:3000", site: "same-origin" }),
        { NEXT_PUBLIC_APP_URL: "http://localhost:3000" },
      ),
    ).toBe(true);
  });

  it("allows the request host even when the canonical URL differs in local dev", () => {
    expect(
      isAllowedMutationOrigin(
        request({ origin: "http://127.0.0.1:3000" }),
        { NEXT_PUBLIC_APP_URL: "http://localhost:3000" },
      ),
    ).toBe(true);
  });

  it("treats a null Origin like a missing one outside deployed production", () => {
    expect(
      isAllowedMutationOrigin(request({ origin: "null" }), {
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      }),
    ).toBe(true);
    expect(
      isAllowedMutationOrigin(request({ origin: "null" }), {
        VERCEL_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://app.example",
      }),
    ).toBe(false);
  });

  it("rejects a cross-site origin in deployed production", () => {
    expect(
      isAllowedMutationOrigin(
        request({
          origin: "https://evil.example",
          site: "cross-site",
          url: "https://app.example/api/messages",
        }),
        {
          VERCEL_ENV: "production",
          NEXT_PUBLIC_APP_URL: "https://app.example",
        },
      ),
    ).toBe(false);
  });
});
