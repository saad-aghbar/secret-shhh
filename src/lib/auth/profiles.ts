import { z } from "zod";

export const profileSlotSchema = z.enum(["user_1", "user_2"]);
export type ProfileSlot = z.infer<typeof profileSlotSchema>;

export type AppProfile = {
  slot: ProfileSlot;
  displayName: string;
  pinHash: string;
};

type ProfileEnv = {
  AUTHORIZED_USER_1_DISPLAY_NAME: string;
  AUTHORIZED_USER_2_DISPLAY_NAME: string;
  AUTHORIZED_USER_1_PIN_HASH?: string;
  AUTHORIZED_USER_2_PIN_HASH?: string;
};

export function getPublicProfiles(env?: {
  AUTHORIZED_USER_1_DISPLAY_NAME?: string;
  AUTHORIZED_USER_2_DISPLAY_NAME?: string;
}) {
  const name1 = env?.AUTHORIZED_USER_1_DISPLAY_NAME || process.env.AUTHORIZED_USER_1_DISPLAY_NAME || "Saad";
  const name2 = env?.AUTHORIZED_USER_2_DISPLAY_NAME || process.env.AUTHORIZED_USER_2_DISPLAY_NAME || "Tala";

  return [
    { slot: "user_1" as const, displayName: name1, initials: initials(name1) },
    { slot: "user_2" as const, displayName: name2, initials: initials(name2) },
  ];
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function getProfilesFromEnv(env: ProfileEnv): AppProfile[] {
  if (!env.AUTHORIZED_USER_1_PIN_HASH || !env.AUTHORIZED_USER_2_PIN_HASH) {
    throw new Error("PIN hashes are not configured");
  }

  return [
    {
      slot: "user_1",
      displayName: env.AUTHORIZED_USER_1_DISPLAY_NAME,
      pinHash: env.AUTHORIZED_USER_1_PIN_HASH,
    },
    {
      slot: "user_2",
      displayName: env.AUTHORIZED_USER_2_DISPLAY_NAME,
      pinHash: env.AUTHORIZED_USER_2_PIN_HASH,
    },
  ];
}

export function getProfileBySlot(slot: ProfileSlot, env: ProfileEnv): AppProfile {
  const profile = getProfilesFromEnv(env).find((item) => item.slot === slot);
  if (!profile) {
    throw new Error("Unknown profile slot");
  }
  return profile;
}
