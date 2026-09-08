import { describe, expect, it } from "vitest";

import { assertProductionEnv, missingProductionEnvNames } from "@/lib/env/production";

describe("production env", () => {
  it("lists missing names without values", () => {
    const missing = missingProductionEnvNames({
      DATABASE_URL: "postgres://example",
      SESSION_SECRET: "x".repeat(32),
    });
    expect(missing).toContain("R2_BUCKET");
    expect(missing.join(" ")).not.toMatch(/postgres:\/\//);
  });

  it("no-ops outside deployed production", () => {
    expect(() => assertProductionEnv({})).not.toThrow();
  });

  it("rejects localhost app URL in deployed production", () => {
    expect(() =>
      assertProductionEnv({
        VERCEL_ENV: "production",
        DATABASE_URL: "postgres://example",
        SESSION_SECRET: "x".repeat(32),
        AUTHORIZED_USER_1_PIN_HASH: "hash",
        AUTHORIZED_USER_2_PIN_HASH: "hash",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        R2_ACCOUNT_ID: "a",
        R2_ACCESS_KEY_ID: "b",
        R2_SECRET_ACCESS_KEY: "c",
        R2_BUCKET: "d",
        R2_ENDPOINT: "https://example.r2.cloudflarestorage.com",
        LIVEKIT_URL: "wss://example.livekit.cloud",
        LIVEKIT_API_KEY: "key",
        LIVEKIT_API_SECRET: "secret",
      }),
    ).toThrow(/NEXT_PUBLIC_APP_URL/);
  });
});
