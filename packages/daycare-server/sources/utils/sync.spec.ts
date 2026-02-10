import { describe, expect, it } from "vitest";
import { InvalidateSync, ValueSync } from "./sync.js";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("InvalidateSync", () => {
  it("coalesces invalidations and runs again when invalidated twice", async () => {
    let runs = 0;
    const sync = new InvalidateSync(async () => {
      runs += 1;
      await wait(5);
    });

    sync.invalidate();
    sync.invalidate();

    await sync.awaitQueue();

    expect(runs).toBe(2);
  });

  it("returns immediately when queue is idle", async () => {
    const sync = new InvalidateSync(async () => {});

    await sync.awaitQueue();
  });

  it("resolves pending awaits on stop", async () => {
    let runs = 0;
    const sync = new InvalidateSync(async () => {
      runs += 1;
      await wait(5);
    });

    const pending = sync.invalidateAndAwait();
    sync.stop();

    await pending;
    expect(runs).toBeLessThanOrEqual(1);
  });
});

describe("ValueSync", () => {
  it("only processes latest value after burst", async () => {
    const processed: number[] = [];
    const sync = new ValueSync<number>(async (value) => {
      processed.push(value);
      await wait(5);
    });

    sync.setValue(1);
    sync.setValue(2);
    sync.setValue(3);

    await sync.awaitQueue();

    expect(processed[0]).toBe(1);
    expect(processed[processed.length - 1]).toBe(3);
  });

  it("resolves setValueAndAwait and skips work after stop", async () => {
    const processed: number[] = [];
    const sync = new ValueSync<number>(async (value) => {
      processed.push(value);
    });

    await sync.setValueAndAwait(1);

    sync.stop();
    sync.setValue(2);
    await sync.awaitQueue();

    expect(processed).toContain(1);
    expect(processed).not.toContain(2);
  });
});
