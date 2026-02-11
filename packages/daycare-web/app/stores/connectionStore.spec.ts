import { describe, it, expect } from "vitest";
import { connectionStoreCreate } from "./connectionStore";

describe("connectionStore", () => {
  it("starts with connected status", () => {
    const store = connectionStoreCreate();
    expect(store.getState().status).toBe("connected");
  });

  it("sets status to reconnecting", () => {
    const store = connectionStoreCreate();
    store.getState().statusSet("reconnecting");
    expect(store.getState().status).toBe("reconnecting");
  });

  it("sets status to disconnected", () => {
    const store = connectionStoreCreate();
    store.getState().statusSet("disconnected");
    expect(store.getState().status).toBe("disconnected");
  });

  it("transitions back to connected", () => {
    const store = connectionStoreCreate();
    store.getState().statusSet("reconnecting");
    store.getState().statusSet("connected");
    expect(store.getState().status).toBe("connected");
  });
});
