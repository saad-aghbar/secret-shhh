/**
 * Optional: configure CORS on the private R2 bucket for direct browser signed PUTs.
 * Shhh R2 uploads use an authenticated same-origin proxy by default, so this is
 * not required for Phase 4. Does not make the bucket public.
 *
 * Usage: pnpm exec tsx scripts/r2-configure-cors.ts
 *
 * Note: object-level S3 credentials often lack PutBucketCors; Access Denied is
 * expected unless the token has bucket admin permission.
 */
import {
  GetBucketCorsCommand,
  PutBucketCorsCommand,
  S3Client,
} from "@aws-sdk/client-s3";

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

  const allowedOrigins = appOrigins();
  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: allowedOrigins,
            AllowedMethods: ["GET", "PUT", "HEAD"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag", "Content-Length", "Content-Type"],
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
      publicAccess: false,
      note: "CORS only — bucket stays private; no public URL or custom domain required.",
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
