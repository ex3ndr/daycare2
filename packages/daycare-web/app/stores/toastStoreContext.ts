import type { ToastStore } from "./toastStore";
import { toastStoreCreate } from "./toastStore";

const store = toastStoreCreate();

export function useToastStore<U>(selector: (state: ToastStore) => U): U {
  return store(selector);
}

export function toastAdd(message: string, variant?: "default" | "success" | "error" | "warning") {
  store.getState().toastAdd(message, variant);
}
