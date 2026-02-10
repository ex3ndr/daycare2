import { afterEach, describe, expect, it, vi } from "vitest";
import { debounceCreate } from "./debounce.js";

describe("debounceCreate", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("coalesces later calls after immediateCount", () => {
    vi.useFakeTimers();

    const calls: number[] = [];
    const debounced = debounceCreate<number>((value) => {
      calls.push(value);
    }, {
      delay: 50,
      immediateCount: 1
    });

    debounced(1);
    debounced(2);
    debounced(3);

    expect(calls).toEqual([1]);

    vi.advanceTimersByTime(49);
    expect(calls).toEqual([1]);

    vi.advanceTimersByTime(1);
    expect(calls).toEqual([1, 3]);
  });
});
