import type { ApiErrorCode } from "@/types/api";

export class InteractionError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, message: string, status: number) {
    super(message);
    this.name = "InteractionError";
    this.code = code;
    this.status = status;
  }
}
