import { afterEach, describe, expect, it, vi } from "vitest";
import { debounceAdvancedCreate, debounceCreate } from "./debounce.js";

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

  it("supports cancel, flush and reset in advanced mode", () => {
    vi.useFakeTimers();

    const calls: number[] = [];
    const advanced = debounceAdvancedCreate<number>((value) => {
      calls.push(value);
    }, {
      delay: 40,
      immediateCount: 1
    });

    advanced.debounced(1);
    advanced.debounced(2);
    advanced.cancel();

    vi.advanceTimersByTime(40);
    expect(calls).toEqual([1]);

    advanced.debounced(3);
    advanced.flush();
    expect(calls).toEqual([1, 3]);

    advanced.reset();
    advanced.debounced(4);
    expect(calls).toEqual([1, 3, 4]);
  });
});
