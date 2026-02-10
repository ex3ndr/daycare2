import { describe, expect, it } from "vitest";
import { apiResponseFail } from "./apiResponseFail.js";

describe("apiResponseFail", () => {
  it("wraps code and message in error response envelope", () => {
    expect(apiResponseFail("FORBIDDEN", "No access")).toEqual({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "No access",
        details: undefined
      }
    });
  });

  it("includes details when provided", () => {
    expect(apiResponseFail("VALIDATION_ERROR", "Invalid input", { field: "email" })).toEqual({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        details: {
          field: "email"
        }
      }
    });
  });
});
