import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toastStoreCreate } from "./toastStore";

describe("toastStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with empty toasts", () => {
    const store = toastStoreCreate();
    expect(store.getState().toasts).toEqual([]);
  });

  it("adds a toast with default variant", () => {
    const store = toastStoreCreate();
    store.getState().toastAdd("Hello");
    const toasts = store.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe("Hello");
    expect(toasts[0].variant).toBe("default");
  });

  it("adds a toast with specified variant", () => {
    const store = toastStoreCreate();
    store.getState().toastAdd("Error occurred", "error");
    expect(store.getState().toasts[0].variant).toBe("error");
  });

  it("dismisses a toast by id", () => {
    const store = toastStoreCreate();
    store.getState().toastAdd("First");
    store.getState().toastAdd("Second");
    expect(store.getState().toasts).toHaveLength(2);

    const firstId = store.getState().toasts[0].id;
    store.getState().toastDismiss(firstId);
    expect(store.getState().toasts).toHaveLength(1);
    expect(store.getState().toasts[0].message).toBe("Second");
  });

  it("auto-dismisses after 5 seconds", () => {
    const store = toastStoreCreate();
    store.getState().toastAdd("Will vanish");
    expect(store.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(4999);
    expect(store.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(store.getState().toasts).toHaveLength(0);
  });

  it("assigns unique ids to each toast", () => {
    const store = toastStoreCreate();
    store.getState().toastAdd("A");
    store.getState().toastAdd("B");
    const [a, b] = store.getState().toasts;
    expect(a.id).not.toBe(b.id);
  });
});
