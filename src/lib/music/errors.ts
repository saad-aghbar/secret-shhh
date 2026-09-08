export type MusicErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "UNAVAILABLE";

export class MusicError extends Error {
  readonly code: MusicErrorCode;
  readonly status: number;

  constructor(code: MusicErrorCode, message: string, status = 400) {
    super(message);
    this.name = "MusicError";
    this.code = code;
    this.status = status;
  }
}
