const USER_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "open.spotify.com",
  "music.apple.com",
  "itunes.apple.com",
]);

const API_HOSTS = new Set([
  ...USER_HOSTS,
  "www.googleapis.com",
  "googleapis.com",
  "accounts.spotify.com",
  "api.spotify.com",
  "i.ytimg.com",
  "is1-ssl.mzstatic.com",
  "is2-ssl.mzstatic.com",
  "is3-ssl.mzstatic.com",
  "is4-ssl.mzstatic.com",
  "is5-ssl.mzstatic.com",
]);

const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isIpv6(hostname: string) {
  return hostname.includes(":") || hostname.startsWith("[");
}

export function isAllowedUserHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTS.has(host) || isPrivateIpv4(host) || isIpv6(host)) return false;
  return USER_HOSTS.has(host);
}

export function isAllowedApiHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTS.has(host) || isPrivateIpv4(host) || isIpv6(host)) return false;
  if (API_HOSTS.has(host)) return true;
  if (host.endsWith(".mzstatic.com") && !host.includes("..")) return true;
  return false;
}

export function assertAllowedUserUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("unsupported_scheme");
  }
  if (!isAllowedUserHost(url.hostname)) {
    throw new Error("unsupported_host");
  }
}

export function assertAllowedApiUrl(url: URL) {
  if (url.protocol !== "https:") {
    throw new Error("unsupported_scheme");
  }
  if (!isAllowedApiHost(url.hostname)) {
    throw new Error("unsupported_host");
  }
}
