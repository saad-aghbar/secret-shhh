import type { DoodleRef } from "@/lib/chat/types";
import { isClientHttpError, toApiClientError } from "@/lib/http/client-error";
import { connectionManager } from "@/lib/connection/manager";
import type { ApiErrorBody } from "@/types/api";

async function parse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T | ApiErrorBody;
  if (!response.ok) {
    const error = body as ApiErrorBody;
    throw toApiClientError(error, response.status);
  }
  return body as T;
}

async function timed<T>(fn: () => Promise<T>): Promise<T> {
  const started = Date.now();
  try {
    const result = await fn();
    connectionManager.reportSuccess(Date.now() - started);
    return result;
  } catch (error) {
    if (!isClientHttpError(error)) {
      connectionManager.reportFailure();
    }
    throw error;
  }
}

const cache = new Map<string, DoodleRef>();
const inflight = new Map<string, Promise<DoodleRef>>();

export async function apiGetDoodle(doodleId: string): Promise<DoodleRef> {
  const existing = cache.get(doodleId);
  if (existing) return existing;
  const pending = inflight.get(doodleId);
  if (pending) return pending;

  const request = timed(async () => {
    const response = await fetch(`/api/doodles/${encodeURIComponent(doodleId)}`, {
      cache: "no-store",
    });
    const body = await parse<{ doodle: DoodleRef }>(response);
    cache.set(doodleId, body.doodle);
    return body.doodle;
  }).finally(() => {
    inflight.delete(doodleId);
  });
  inflight.set(doodleId, request);
  return request;
}

export function rememberDoodle(doodle: DoodleRef) {
  cache.set(doodle.id, doodle);
}
