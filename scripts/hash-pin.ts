#!/usr/bin/env npx tsx
/**
 * Interactive PIN hasher for .env.local
 * Usage: pnpm auth:hash-pin
 *
 * Prints a base64:… value so Next.js env loading cannot corrupt `$` in Argon2 hashes.
 */
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { hashPassword, isAcceptablePassword } from "../src/lib/auth/pin";
import { encodePinHashForEnv } from "../src/lib/env";

const minLengthNote = "any non-empty password";

async function readPin(prompt: string): Promise<string> {
  const rl = createInterface({ input, output, terminal: true });
  try {
    output.write("(input is visible in this terminal — clear history after)\n");
    const value = await rl.question(prompt);
    return value.trim();
  } finally {
    rl.close();
  }
}

async function main() {
  output.write(`Argon2id password hash generator (${minLengthNote})\n\n`);
  const pin = await readPin("Password: ");
  if (!isAcceptablePassword(pin)) {
    console.error("Password must be non-empty (max 1024 chars).");
    process.exit(1);
  }
  const confirm = await readPin("Confirm password: ");
  if (pin !== confirm) {
    console.error("Passwords do not match.");
    process.exit(1);
  }
  const pinHash = await hashPassword(pin);
  output.write("\nPaste into .env.local (never commit):\n\n");
  output.write(`${encodePinHashForEnv(pinHash)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Failed");
  process.exit(1);
});
