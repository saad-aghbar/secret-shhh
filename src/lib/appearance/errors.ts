import {
  forbidden,
  jsonError,
  validationError,
} from "@/lib/http/api-error";
import {
  AppearanceForbiddenError,
  AppearanceNotFoundError,
} from "@/lib/appearance/service";
import { AppearanceValidationError } from "@/lib/appearance/validation";

export function mapAppearanceError(error: unknown) {
  if (error instanceof AppearanceValidationError) {
    return validationError(error.message);
  }
  if (error instanceof AppearanceNotFoundError) {
    return jsonError("NOT_FOUND", error.message, 404);
  }
  if (error instanceof AppearanceForbiddenError) {
    return forbidden();
  }
  return null;
}
