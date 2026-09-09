import { describe, expect, it } from "vitest";

import { hashPassword, isAcceptablePassword, verifyPassword } from "@/lib/auth/pin";
import { getProfileBySlot, getPublicProfiles } from "@/lib/auth/profiles";
import { hashSessionToken } from "@/lib/auth/session-store";
import { parsePublicEnv, parseServerEnv } from "@/lib/env";
import { APP_SECTIONS, getSection } from "@/components/shell/sections";

describe("parsePublicEnv", () => {
  it("applies defaults when values are missing", () => {
    const env = parsePublicEnv({});
    expect(env.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
    expect(env.NEXT_PUBLIC_APP_NAME).toBe("Shhh");
  });

  it("accepts the production https origin and strips a trailing slash", () => {
    const env = parsePublicEnv({
      NEXT_PUBLIC_APP_URL: "https://shhh-one-zeta.vercel.app/",
    });
    expect(env.NEXT_PUBLIC_APP_URL).toBe("https://shhh-one-zeta.vercel.app");
  });
});

describe("parseServerEnv", () => {
  const base = {
    DATABASE_URL: "postgresql://localhost:5432/shhh",
    AUTHORIZED_USER_1_PIN_HASH:
      "base64:" +
      Buffer.from("$argon2id$v=19$m=19456,t=2,p=1$abc$def", "utf8").toString("base64"),
    AUTHORIZED_USER_2_PIN_HASH:
      "base64:" +
      Buffer.from("$argon2id$v=19$m=19456,t=2,p=1$ghi$jkl", "utf8").toString("base64"),
    SESSION_SECRET: "x".repeat(32),
  };

  it("parses PIN auth credentials and defaults", () => {
    const env = parseServerEnv(base);
    expect(env.AUTHORIZED_USER_1_DISPLAY_NAME).toBe("Saad");
    expect(env.AUTHORIZED_USER_2_DISPLAY_NAME).toBe("Tala");
    expect(env.AUTH_PIN_MIN_LENGTH).toBe(6);
    expect(env.AUTH_SESSION_DAYS).toBe(30);
    expect(env.AUTHORIZED_USER_1_PIN_HASH.startsWith("$argon2id$")).toBe(true);
  });

  it("rejects short SESSION_SECRET", () => {
    expect(() =>
      parseServerEnv({
        ...base,
        SESSION_SECRET: "short",
      }),
    ).toThrow();
  });

  it("rejects missing PIN hashes", () => {
    expect(() =>
      parseServerEnv({
        DATABASE_URL: "postgresql://localhost:5432/shhh",
        SESSION_SECRET: "x".repeat(32),
      }),
    ).toThrow();
  });
});

describe("password hashing", () => {
  it("verifies a matching password and rejects a wrong one", async () => {
    const passwordHash = await hashPassword("anything-goes!");
    expect(await verifyPassword("anything-goes!", passwordHash)).toBe(true);
    expect(await verifyPassword("nope", passwordHash)).toBe(false);
  });

  it("accepts any non-empty password shape", () => {
    expect(isAcceptablePassword("a")).toBe(true);
    expect(isAcceptablePassword("000000")).toBe(true);
    expect(isAcceptablePassword("你好 🌟")).toBe(true);
    expect(isAcceptablePassword("")).toBe(false);
  });
});

describe("profiles", () => {
  it("exposes Saad and Tala cards without secrets", () => {
    const cards = getPublicProfiles({
      AUTHORIZED_USER_1_DISPLAY_NAME: "Saad",
      AUTHORIZED_USER_2_DISPLAY_NAME: "Tala",
    });
    expect(cards.map((c) => c.slot)).toEqual(["user_1", "user_2"]);
    expect(cards[0]?.displayName).toBe("Saad");
  });

  it("resolves slot to PIN hash server-side only", () => {
    const profile = getProfileBySlot("user_1", {
      AUTHORIZED_USER_1_DISPLAY_NAME: "Saad",
      AUTHORIZED_USER_2_DISPLAY_NAME: "Tala",
      AUTHORIZED_USER_1_PIN_HASH: "hash-one",
      AUTHORIZED_USER_2_PIN_HASH: "hash-two",
    });
    expect(profile.pinHash).toBe("hash-one");
    expect(profile.displayName).toBe("Saad");
  });
});

describe("session token hashing", () => {
  it("hashes tokens stably without storing plaintext", () => {
    const a = hashSessionToken("token-a");
    const b = hashSessionToken("token-a");
    const c = hashSessionToken("token-b");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toContain("token-a");
  });
});

describe("app section registry", () => {
  it("exposes the four primary destinations", () => {
    expect(APP_SECTIONS.map((s) => s.id)).toEqual(["chat", "media", "music", "more"]);
  });

  it("resolves chat as home destination", () => {
    expect(getSection("chat").href).toBe("/chat");
  });
});
