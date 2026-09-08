export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "UPLOAD_FAILED"
  | "CONFLICT"
  | "INTERNAL"
  | "FORCE_FAIL"
  | "RATE_LIMITED";

export type ApiErrorBody = {
  code: ApiErrorCode;
  message: string;
};
