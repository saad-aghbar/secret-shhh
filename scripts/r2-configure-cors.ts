/**
 * Configure CORS on the private R2 bucket for direct browser signed PUTs/GETs.
 * Does not make the bucket public.
 *
 * Usage (include the production origin, keep local .env.local for credentials):
 *   NEXT_PUBLIC_APP_URL=https://shhh-one-zeta.vercel.app pnpm r2:cors
 *
 * Note: object-level S3 credentials often lack PutBucketCors; Access Denied is
 * expected unless the token has bucket admin permission.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  GetBucketCorsCommand,
  PutBucketCorsCommand,
  S3Client,
} from "@aws-sdk/client-s3";

function applyEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq);
    let value = line.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function appOrigins(): string[] {
  const origins = new Set<string>([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://shhh-one-zeta.vercel.app",
  ]);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    try {
      origins.add(new URL(appUrl).origin);
    } catch {
      // ignore invalid
    }
  }
  return [...origins];
}

async function main() {
  applyEnvLocal();
  const accountId = requireEnv("R2_ACCOUNT_ID");
  const accessKeyId = requireEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY");
  const bucket = requireEnv("R2_BUCKET");
  const endpoint =
    process.env.R2_ENDPOINT?.trim() ||
    `https://${accountId}.r2.cloudflarestorage.com`;

  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  // Browser signed PUT/GET only send Content-Type as a non-simple header.
  // ETag is read after multipart part uploads.
  const allowedOrigins = appOrigins();
  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: allowedOrigins,
            AllowedMethods: ["GET", "PUT", "HEAD"],
            AllowedHeaders: ["Content-Type"],
            ExposeHeaders: ["ETag", "Content-Length"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );

  const current = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
  const rules = current.CORSRules ?? [];
  console.log(
    JSON.stringify({
      ok: true,
      bucket,
      ruleCount: rules.length,
      allowedOrigins: rules.flatMap((r) => r.AllowedOrigins ?? []),
      allowedMethods: rules.flatMap((r) => r.AllowedMethods ?? []),
      allowedHeaders: rules.flatMap((r) => r.AllowedHeaders ?? []),
      exposeHeaders: rules.flatMap((r) => r.ExposeHeaders ?? []),
      publicAccess: false,
      note: "CORS only — bucket stays private; no public URL or custom domain required.",
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
