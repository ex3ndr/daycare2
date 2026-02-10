import { describe, expect, it } from "vitest";
import { apiResponseOk } from "./apiResponseOk.js";

describe("apiResponseOk", () => {
  it("wraps payload in success response envelope", () => {
    const payload = { id: "m1", text: "Hello" };

    expect(apiResponseOk(payload)).toEqual({
      ok: true,
      data: payload
    });
  });
});
