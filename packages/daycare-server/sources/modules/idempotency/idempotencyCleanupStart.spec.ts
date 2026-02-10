import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("idempotencyCleanupStart", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("removes expired idempotency records", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "i1" },
      { id: "i2" }
    ]);
    const deleteMany = vi.fn().mockResolvedValue({ count: 2 });

    const db = {
      idempotencyKey: {
        findMany,
        deleteMany
      }
    } as any;

    const { idempotencyCleanupStart } = await import("./idempotencyCleanupStart.js");
    const stop = idempotencyCleanupStart(db, { intervalMs: 1000, retentionMs: 0 });

    await vi.advanceTimersByTimeAsync(1000);

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(deleteMany).toHaveBeenCalledTimes(1);

    stop();
  });

  it("skips delete when no records are expired", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });

    const db = {
      idempotencyKey: {
        findMany,
        deleteMany
      }
    } as any;

    const { idempotencyCleanupStart } = await import("./idempotencyCleanupStart.js");
    const stop = idempotencyCleanupStart(db, { intervalMs: 1000, retentionMs: 0 });

    await vi.advanceTimersByTimeAsync(1000);

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(deleteMany).not.toHaveBeenCalled();

    stop();
  });
});
