import { isDeployedProduction } from "@/lib/env/runtime";

function r2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      process.env.R2_ENDPOINT,
  );
}

export function isTestStorageEnabled() {
  if (isDeployedProduction()) return false;
  if (process.env.STORAGE_PROVIDER === "r2") return false;
  if (process.env.STORAGE_PROVIDER === "test") return true;
  return !r2Configured();
}
