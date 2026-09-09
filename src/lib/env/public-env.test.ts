import { afterEach, describe, expect, it } from "vitest";

import { parsePublicEnv } from "@/lib/public-env";

const originalVercelEnv = process.env.VERCEL_ENV;

afterEach(() => {
  if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = originalVercelEnv;
});

describe("parsePublicEnv production", () => {
  it("rejects localhost when VERCEL_ENV=production", () => {
    process.env.VERCEL_ENV = "production";
    expect(() =>
      parsePublicEnv({ NEXT_PUBLIC_APP_URL: "http://localhost:3000" }),
    ).toThrow(/NEXT_PUBLIC_APP_URL/);
  });

  it("rejects a missing URL when VERCEL_ENV=production", () => {
    process.env.VERCEL_ENV = "production";
    expect(() => parsePublicEnv({})).toThrow(/NEXT_PUBLIC_APP_URL/);
  });

  it("accepts the Vercel production origin when VERCEL_ENV=production", () => {
    process.env.VERCEL_ENV = "production";
    const env = parsePublicEnv({
      NEXT_PUBLIC_APP_URL: "https://shhh-one-zeta.vercel.app",
    });
    expect(env.NEXT_PUBLIC_APP_URL).toBe("https://shhh-one-zeta.vercel.app");
  });
});
