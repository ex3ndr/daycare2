import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { channelOrderRead, channelOrderWrite } from "./sidebarChannelOrder";

// Node 22 has a broken built-in localStorage (requires --localstorage-file).
// Replace it with a simple in-memory mock for tests.
function createMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

let origStorage: Storage;

beforeEach(() => {
  origStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", {
    value: createMockStorage(),
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    value: origStorage,
    writable: true,
    configurable: true,
  });
});

describe("channelOrderRead", () => {
  it("returns empty array when no stored order", () => {
    expect(channelOrderRead("org-1")).toEqual([]);
  });

  it("reads stored order", () => {
    localStorage.setItem("daycare:channelOrder:org-1", JSON.stringify(["a", "b", "c"]));
    expect(channelOrderRead("org-1")).toEqual(["a", "b", "c"]);
  });

  it("filters out non-string values", () => {
    localStorage.setItem("daycare:channelOrder:org-1", JSON.stringify(["a", 42, null, "b"]));
    expect(channelOrderRead("org-1")).toEqual(["a", "b"]);
  });

  it("returns empty array for non-array JSON", () => {
    localStorage.setItem("daycare:channelOrder:org-1", JSON.stringify({ a: 1 }));
    expect(channelOrderRead("org-1")).toEqual([]);
  });

  it("returns empty array for invalid JSON", () => {
    localStorage.setItem("daycare:channelOrder:org-1", "not-json");
    expect(channelOrderRead("org-1")).toEqual([]);
  });
});

describe("channelOrderWrite", () => {
  it("persists order to localStorage", () => {
    channelOrderWrite("org-1", ["x", "y"]);
    expect(JSON.parse(localStorage.getItem("daycare:channelOrder:org-1")!)).toEqual(["x", "y"]);
  });

  it("overwrites previous order", () => {
    channelOrderWrite("org-1", ["a"]);
    channelOrderWrite("org-1", ["b", "c"]);
    expect(JSON.parse(localStorage.getItem("daycare:channelOrder:org-1")!)).toEqual(["b", "c"]);
  });

  it("uses org-scoped key", () => {
    channelOrderWrite("org-1", ["a"]);
    channelOrderWrite("org-2", ["b"]);
    expect(JSON.parse(localStorage.getItem("daycare:channelOrder:org-1")!)).toEqual(["a"]);
    expect(JSON.parse(localStorage.getItem("daycare:channelOrder:org-2")!)).toEqual(["b"]);
  });
});
