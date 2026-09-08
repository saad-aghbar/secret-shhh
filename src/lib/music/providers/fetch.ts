import { assertAllowedApiUrl } from "@/lib/music/providers/allowlist";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_BODY_BYTES = 1_000_000;
const MAX_REDIRECTS = 3;

export class ProviderFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderFetchError";
  }
}

function parseUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ProviderFetchError("unsupported_url");
  }
  assertAllowedApiUrl(url);
  return url;
}

async function readLimited(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (text.length > MAX_BODY_BYTES) {
      throw new ProviderFetchError("response_too_large");
    }
    return text;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new ProviderFetchError("response_too_large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function providerFetch(input: {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
}): Promise<{ status: number; text: string }> {
  let current = parseUrl(input.url);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(current, {
        method: input.method ?? "GET",
        headers: {
          accept: "application/json, text/plain;q=0.8, */*;q=0.5",
          "user-agent": "Shhh/1.0",
          ...input.headers,
        },
        body: input.body,
        redirect: "manual",
        signal: controller.signal,
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          throw new ProviderFetchError("redirect_missing");
        }
        const next = new URL(location, current);
        assertAllowedApiUrl(next);
        current = next;
        continue;
      }
      const text = await readLimited(response);
      return { status: response.status, text };
    } catch (error) {
      if (error instanceof ProviderFetchError) throw error;
      throw new ProviderFetchError("provider_unavailable");
    } finally {
      clearTimeout(timer);
    }
  }
  throw new ProviderFetchError("too_many_redirects");
}

export async function providerFetchJson<T>(input: {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
}): Promise<T> {
  const { status, text } = await providerFetch(input);
  if (status < 200 || status >= 300) {
    throw new ProviderFetchError("provider_unavailable");
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ProviderFetchError("invalid_json");
  }
}
