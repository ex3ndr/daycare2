import type { UiStore } from "./uiStore";
import { uiStoreCreate } from "./uiStore";

// Single global UI store instance — UI state is not per-org
const store = uiStoreCreate();

export function useUiStore<U>(selector: (state: UiStore) => U): U {
  return store(selector);
}
