import { describe, expect, it } from "vitest";
import { ApiError } from "./apiError.js";

describe("ApiError", () => {
  it("stores status, code, message and details", () => {
    const error = new ApiError(403, "FORBIDDEN", "No access", { resource: "chat" });

    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe("FORBIDDEN");
    expect(error.message).toBe("No access");
    expect(error.details).toEqual({ resource: "chat" });
  });

  it("keeps details undefined when omitted", () => {
    const error = new ApiError(401, "UNAUTHORIZED", "Missing token");
    expect(error.details).toBeUndefined();
  });
});
