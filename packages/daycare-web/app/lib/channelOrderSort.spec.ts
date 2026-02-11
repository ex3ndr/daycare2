import { describe, it, expect } from "vitest";
import { channelOrderSort } from "./channelOrderSort";

const ch = (id: string, name: string) => ({ id, name });

describe("channelOrderSort", () => {
  it("sorts alphabetically when no custom order", () => {
    const channels = [ch("3", "zebra"), ch("1", "alpha"), ch("2", "beta")];
    const result = channelOrderSort(channels, []);
    expect(result.map((c) => c.name)).toEqual(["alpha", "beta", "zebra"]);
  });

  it("applies custom order when provided", () => {
    const channels = [ch("1", "alpha"), ch("2", "beta"), ch("3", "gamma")];
    const result = channelOrderSort(channels, ["3", "1", "2"]);
    expect(result.map((c) => c.id)).toEqual(["3", "1", "2"]);
  });

  it("puts unordered channels at end alphabetically", () => {
    const channels = [
      ch("1", "alpha"),
      ch("2", "beta"),
      ch("3", "gamma"),
      ch("4", "delta"),
    ];
    // Only 2 and 1 are in custom order; 3 and 4 should be appended alphabetically
    const result = channelOrderSort(channels, ["2", "1"]);
    expect(result.map((c) => c.id)).toEqual(["2", "1", "4", "3"]);
    // delta (4) comes before gamma (3) alphabetically
    expect(result.map((c) => c.name)).toEqual(["beta", "alpha", "delta", "gamma"]);
  });

  it("ignores stale IDs in order that are not in channels", () => {
    const channels = [ch("1", "alpha"), ch("2", "beta")];
    const result = channelOrderSort(channels, ["999", "2", "1"]);
    expect(result.map((c) => c.id)).toEqual(["2", "1"]);
  });

  it("does not mutate the original array", () => {
    const channels = [ch("2", "beta"), ch("1", "alpha")];
    const copy = [...channels];
    channelOrderSort(channels, ["1", "2"]);
    expect(channels).toEqual(copy);
  });

  it("handles empty channels", () => {
    expect(channelOrderSort([], ["1", "2"])).toEqual([]);
  });

  it("handles single channel", () => {
    const result = channelOrderSort([ch("1", "alpha")], []);
    expect(result).toEqual([ch("1", "alpha")]);
  });
});
