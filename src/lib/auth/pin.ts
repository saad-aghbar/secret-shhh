import { hash, verify } from "@node-rs/argon2";

/** Argon2id parameters suitable for interactive login on personal devices. */
const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  algorithm: 2 as const, // Argon2id
};

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  try {
    // Hash string already embeds Argon2 parameters — do not re-pass options.
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** @deprecated use hashPassword */
export const hashPin = hashPassword;
/** @deprecated use verifyPassword */
export const verifyPin = verifyPassword;

/** Soft upper bound only to avoid abuse — no character-set or min-length rules. */
export function isAcceptablePassword(password: string): boolean {
  return password.length > 0 && password.length <= 1024;
}
