import { describe, expect, it } from "vitest";
import { AsyncLock } from "./lock.js";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("AsyncLock", () => {
  it("runs critical sections one by one", async () => {
    const lock = new AsyncLock();
    const order: string[] = [];

    await Promise.all([
      lock.inLock(async () => {
        order.push("a-start");
        await wait(20);
        order.push("a-end");
      }),
      lock.inLock(async () => {
        order.push("b-start");
        await wait(5);
        order.push("b-end");
      })
    ]);

    expect(order).toEqual(["a-start", "a-end", "b-start", "b-end"]);
  });
});
