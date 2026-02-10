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
});
