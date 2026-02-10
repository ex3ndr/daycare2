import { describe, expect, it } from "vitest";
import { tokenServiceCreate } from "./tokenServiceCreate.js";

describe("tokenServiceCreate", () => {
  it("issues token and verifies claims", async () => {
    const service = await tokenServiceCreate("daycare-test", "daycare-token-seed-1234567890abcdef");
    const token = await service.issue("session-1", { role: "admin" });

    expect(typeof token).toBe("string");
    await expect(service.verify(token)).resolves.toEqual({
      sessionId: "session-1",
      extras: {
        role: "admin"
      }
    });
  });

  it("returns null for invalid token", async () => {
    const service = await tokenServiceCreate("daycare-test", "daycare-token-seed-1234567890abcdef");
    await expect(service.verify("invalid-token")).resolves.toBeNull();
  });
});
