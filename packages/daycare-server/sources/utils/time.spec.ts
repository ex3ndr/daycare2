import { afterEach, describe, expect, it, vi } from "vitest";
import { createBackoff, delay, exponentialBackoffDelay } from "./time.js";

describe("time utilities", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it("resolves delay after timer elapses", async () => {
    vi.useFakeTimers();

    const done = vi.fn();
    const promise = delay(25).then(done);

    await vi.advanceTimersByTimeAsync(24);
    expect(done).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await promise;
    expect(done).toHaveBeenCalledTimes(1);
  });
});
