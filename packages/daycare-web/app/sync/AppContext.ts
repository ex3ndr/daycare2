import * as React from "react";
import { useStore } from "zustand";
import type { ExtractState, StoreApi } from "zustand";
import type { AppController } from "./AppController";
import type { StorageStore } from "./storageStoreCreate";

export const AppContext = React.createContext<AppController | null>(null);

export function useApp(): AppController {
  const app = React.useContext(AppContext);
  if (!app) throw new Error("useApp must be used within AppContext");
  return app;
}

export function useStorage<U>(
  selector: (state: ExtractState<StoreApi<StorageStore>>) => U,
): U {
  const app = useApp();
  return useStore(app.storage, selector);
}
