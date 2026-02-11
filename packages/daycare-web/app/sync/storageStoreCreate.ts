import { create } from "zustand";
import type {
  SyncEngine,
  InferMutations,
  InferMutationInput,
  PartialLocalUpdate,
} from "@slopus/sync";
import type { Schema } from "./schema";
import { schema } from "./schema";

export type StorageStore = {
  objects: SyncEngine<Schema>["state"];
  updateObjects: () => void;
  mutate: <M extends InferMutations<typeof schema>>(
    name: M,
    input: InferMutationInput<typeof schema, M>,
  ) => void;
  rebaseLocal: (snapshot: PartialLocalUpdate<Schema>) => void;
};

export function storageStoreCreate(
  engine: SyncEngine<Schema>,
  onMutate?: () => void,
) {
  return create<StorageStore>((set) => ({
    objects: engine.state,
    updateObjects: () => set((s) => ({ ...s, objects: engine.state })),
    mutate: (name, input) => {
      engine.mutate(name, input);
      set((s) => ({ ...s, objects: engine.state }));
      onMutate?.();
    },
    rebaseLocal: (snapshot) => {
      engine.rebase(snapshot, {
        allowLocalFields: true,
        allowServerFields: false,
      });
      set((s) => ({ ...s, objects: engine.state }));
    },
  }));
}
