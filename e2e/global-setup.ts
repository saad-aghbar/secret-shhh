import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return {} as Record<string, string>;
  }
  const env: Record<string, string> = {};
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const index = trimmed.indexOf("=");
    if (index === -1) {
      continue;
    }
    const key = trimmed.slice(0, index);
    let value = trimmed.slice(index + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const fileEnv = {
  ...loadEnvFile(path.resolve(__dirname, "../.env")),
  ...loadEnvFile(path.resolve(__dirname, "../.env.local")),
};

for (const [key, value] of Object.entries(fileEnv)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}

/**
 * Shared Postgres keeps route-limit counters across runs. Clear the
 * two-person abuse windows so a leftover e2e suite cannot 429 the next one.
 * Do not touch login PIN keys.
 */
export default async function globalSetup() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;

  const pool = new Pool({ connectionString });
  try {
    await pool.query(
      `DELETE FROM login_throttle
       WHERE key LIKE 'call-token:%'
          OR key LIKE 'call-start:%'
          OR key LIKE 'upload-init:%'
          OR key LIKE 'wallpaper-init:%'
          OR key LIKE 'music-resolve:%'
          OR key LIKE 'music-search:%'
          OR key LIKE 'music-match:%'`,
    );
  } finally {
    await pool.end();
  }
}
