/**
 * Runtime deployment flags. Safe to import from server or browser-shared modules.
 * Never log secret values from here.
 */

export function isDeployedProduction() {
  return process.env.VERCEL_ENV === "production";
}

export function isLocalhostHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.+$/, "");
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
}

export function isCanonicalProductionUrl(raw: string | undefined) {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !isLocalhostHostname(url.hostname);
  } catch {
    return false;
  }
}
