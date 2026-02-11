import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sessionGet, sessionSet, sessionClear } from "./sessionStore";

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

describe("sessionStore", () => {
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

  it("returns null when no session stored", () => {
    expect(sessionGet()).toBeNull();
  });

  it("stores and retrieves a session", () => {
    sessionSet({ token: "tok_abc", accountId: "acc_123" });
    expect(sessionGet()).toEqual({ token: "tok_abc", accountId: "acc_123" });
  });

  it("clears session", () => {
    sessionSet({ token: "tok_abc", accountId: "acc_123" });
    sessionClear();
    expect(sessionGet()).toBeNull();
  });

  it("returns null for corrupt data", () => {
    localStorage.setItem("daycare:session", "not-json");
    expect(sessionGet()).toBeNull();
  });

  it("returns null for data missing required fields", () => {
    localStorage.setItem("daycare:session", JSON.stringify({ token: "tok" }));
    expect(sessionGet()).toBeNull();
  });

  it("returns null for data with wrong types", () => {
    localStorage.setItem(
      "daycare:session",
      JSON.stringify({ token: 123, accountId: true }),
    );
    expect(sessionGet()).toBeNull();
  });

  it("overwrites existing session", () => {
    sessionSet({ token: "old", accountId: "old_id" });
    sessionSet({ token: "new", accountId: "new_id" });
    expect(sessionGet()).toEqual({ token: "new", accountId: "new_id" });
  });

  it("stores and retrieves session with orgSlug", () => {
    sessionSet({ token: "tok_abc", accountId: "acc_123", orgSlug: "my-org" });
    const session = sessionGet();
    expect(session).toEqual({ token: "tok_abc", accountId: "acc_123", orgSlug: "my-org" });
  });

  it("retrieves session without orgSlug (backward compat)", () => {
    localStorage.setItem(
      "daycare:session",
      JSON.stringify({ token: "tok_abc", accountId: "acc_123" }),
    );
    const session = sessionGet();
    expect(session).not.toBeNull();
    expect(session!.token).toBe("tok_abc");
    expect(session!.orgSlug).toBeUndefined();
  });
});
