import { describe, expect, it } from "vitest";

import {
  isClientHttpError,
  isUnsendableStickerError,
  toApiClientError,
} from "@/lib/http/client-error";

describe("client HTTP errors", () => {
  it("does not treat 4xx as a dropped connection", () => {
    expect(isClientHttpError(toApiClientError({ code: "VALIDATION_ERROR" }, 400))).toBe(true);
    expect(isClientHttpError(toApiClientError({ code: "NOT_FOUND" }, 404))).toBe(true);
    expect(isClientHttpError(toApiClientError({ code: "INTERNAL" }, 500))).toBe(false);
    expect(isClientHttpError(toApiClientError({ code: "FORCE_FAIL" }, 503))).toBe(false);
    expect(isClientHttpError(new Error("network"))).toBe(false);
  });

  it("drops sticker sends that the server will never accept", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(
      isUnsendableStickerError(
        toApiClientError({ code: "VALIDATION_ERROR", message: "Sticker unavailable." }, 400),
        id,
      ),
    ).toBe(true);
    expect(isUnsendableStickerError(toApiClientError({ code: "NOT_FOUND" }, 404), id)).toBe(true);
    expect(
      isUnsendableStickerError(
        toApiClientError(
          { code: "VALIDATION_ERROR", message: "That message couldn’t be sent." },
          400,
        ),
        id,
      ),
    ).toBe(false);
    expect(
      isUnsendableStickerError(toApiClientError({ code: "VALIDATION_ERROR" }, 400), undefined),
    ).toBe(false);
  });
});
