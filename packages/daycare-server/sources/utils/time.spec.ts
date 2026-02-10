import { describe, expect, it } from "vitest";
import { createBackoff, exponentialBackoffDelay } from "./time.js";

describe("time utilities", () => {
  it("returns bounded backoff delay", () => {
    const value = exponentialBackoffDelay(3, 100, 1000, 10);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1000);
  });

  it("retries until callback succeeds", async () => {
    let attempts = 0;
    const backoff = createBackoff({ minDelay: 0, maxDelay: 0, maxFailureCount: 3 });

    const result = await backoff(async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error("not yet");
      }
      return "ok";
    });

    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });
});
