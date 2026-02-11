import { describe, expect, it } from "vitest";
import { authOtpCodeCreate } from "./authOtpCodeCreate.js";

describe("authOtpCodeCreate", () => {
  it("returns a six digit string", () => {
    const code = authOtpCodeCreate();
    expect(code).toMatch(/^\d{6}$/);
  });
});
