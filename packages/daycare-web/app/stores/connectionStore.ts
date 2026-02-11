import { create } from "zustand";

export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

export type ConnectionStore = {
  status: ConnectionStatus;
  statusSet: (status: ConnectionStatus) => void;
};

export const connectionStoreCreate = () =>
  create<ConnectionStore>((set) => ({
    status: "connected",
    statusSet: (status) => set({ status }),
  }));
