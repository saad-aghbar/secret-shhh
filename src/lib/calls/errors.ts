import { jsonError } from "@/lib/http/api-error";

export class CallError extends Error {
  constructor(
    readonly code:
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "CONFLICT"
      | "VALIDATION_ERROR"
      | "UNAVAILABLE"
      | "RATE_LIMITED",
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "CallError";
  }
}

export function mapCallError(error: unknown) {
  if (!(error instanceof CallError)) return null;
  if (error.code === "RATE_LIMITED") {
    return jsonError("CONFLICT", error.message, 429);
  }
  return jsonError(error.code === "UNAVAILABLE" ? "INTERNAL" : error.code, error.message, error.status);
}
