import type { UiStore, FailedMessageData } from "./uiStore";
import { uiStoreCreate } from "./uiStore";

// Single global UI store instance — UI state is not per-org
const store = uiStoreCreate();

export function useUiStore<U>(selector: (state: UiStore) => U): U {
  return store(selector);
}

export function failedMessageAdd(id: string, data: FailedMessageData) {
  store.getState().failedMessageAdd(id, data);
}

export function failedMessageRemove(id: string) {
  store.getState().failedMessageRemove(id);
}
