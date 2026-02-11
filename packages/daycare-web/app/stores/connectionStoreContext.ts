import type { ConnectionStore } from "./connectionStore";
import { connectionStoreCreate } from "./connectionStore";

const store = connectionStoreCreate();

export function useConnectionStore<U>(selector: (state: ConnectionStore) => U): U {
  return store(selector);
}

export function connectionStatusSet(status: "connected" | "reconnecting" | "disconnected") {
  store.getState().statusSet(status);
}
