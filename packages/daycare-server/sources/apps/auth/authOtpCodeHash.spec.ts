import { describe, expect, it } from "vitest";
import { authOtpCodeHash } from "./authOtpCodeHash.js";

describe("authOtpCodeHash", () => {
  it("hashes with salt deterministically", () => {
    const first = authOtpCodeHash("123456", "salt");
    const second = authOtpCodeHash("123456", "salt");

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes when code or salt changes", () => {
    const base = authOtpCodeHash("123456", "salt");
    expect(authOtpCodeHash("654321", "salt")).not.toBe(base);
    expect(authOtpCodeHash("123456", "other")).not.toBe(base);
  });
});
