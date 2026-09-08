import type { ApiErrorCode } from "@/types/api";

export type ApiClientError = Error & { code?: ApiErrorCode | string; status?: number };

export function toApiClientError(
  body: { code?: string; message?: string },
  status: number,
): ApiClientError {
  const err = new Error(body.message || "Request failed") as ApiClientError;
  err.code = body.code;
  err.status = status;
  return err;
}

/** 4xx is an app answer, not a dropped connection. 408 is a timeout. */
export function isClientHttpError(error: unknown): boolean {
  const status = (error as { status?: number }).status;
  return typeof status === "number" && status >= 400 && status < 500 && status !== 408;
}

/** Archived / missing stickers must leave the outbox, not retry forever. */
export function isUnsendableStickerError(error: unknown, stickerId?: string): boolean {
  if (!stickerId) return false;
  const code = (error as { code?: string }).code;
  const status = (error as { status?: number }).status;
  const message = error instanceof Error ? error.message : "";
  if (code === "NOT_FOUND" || code === "FORBIDDEN" || status === 404 || status === 403) {
    return true;
  }
  if (code === "VALIDATION_ERROR" || status === 400) {
    return /unavailable|couldn['’]t find/i.test(message);
  }
  return false;
}
