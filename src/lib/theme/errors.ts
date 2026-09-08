import { ThemeValidationError } from "@/lib/theme/validation";
import { validationError } from "@/lib/http/api-error";

export function mapThemeError(error: unknown) {
  if (error instanceof ThemeValidationError) {
    return validationError(error.message);
  }
  return null;
}
